import { getCorsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireStaffPermission } from '../_shared/auth.ts';

function escapeCsvCell(val: unknown): string {
  let str = val === null || val === undefined ? '' : String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function buildSafeCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return lines.join('\r\n');
}

function resolveDateWindow(period = 'monthly', startDate?: string, endDate?: string) {
  const today = new Date();
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  if (period === 'custom' && startDate && endDate) {
    return startDate <= endDate ? { start: startDate, end: endDate } : { start: endDate, end: startDate };
  }
  const end = toIso(today);
  const startD = new Date(today);
  if (period === 'daily') startD.setUTCDate(startD.getUTCDate() - 1);
  else if (period === 'weekly') startD.setUTCDate(startD.getUTCDate() - 7);
  else startD.setUTCDate(startD.getUTCDate() - 30);
  return { start: toIso(startD), end };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'summary');

    if (action === 'summary') {
      const ctx = await requireStaffPermission(req, 'analytics.view');
      if (ctx.error || !ctx.adminClient || !ctx.staff) {
        return jsonResponse({ ok: false, code: 'FORBIDDEN', message: ctx.error }, 403);
      }

      const { start, end } = resolveDateWindow(body.period, body.startDate, body.endDate);
      const { data, error } = await ctx.adminClient.rpc('fn_analytics_summary', {
        p_start_date: start,
        p_end_date: end,
      });

      if (error) {
        return jsonResponse({ ok: false, code: 'ANALYTICS_QUERY_ERROR', message: error.message }, 400);
      }

      return jsonResponse({ ok: true, summary: data }, 200);
    }

    if (action === 'report_preview' || action === 'export_csv') {
      const exportCtx = await requireStaffPermission(req, 'reports.export');
      if (exportCtx.error || !exportCtx.adminClient || !exportCtx.staff) {
        return jsonResponse({ ok: false, code: 'FORBIDDEN', message: exportCtx.error }, 403);
      }

      const category = String(body.category || 'customer-activity');
      const dateFrom = body.dateFrom ? String(body.dateFrom) : '2000-01-01';
      const dateTo = body.dateTo ? String(body.dateTo) : '2099-12-31';
      const fromTs = `${dateFrom}T00:00:00.000Z`;
      const toTs = `${dateTo}T23:59:59.999Z`;
      const page = Math.max(1, Number(body.page || 1));
      const pageSize = Math.min(100, Math.max(1, Number(body.pageSize || 10)));

      const [custRes, profRes, progRes] = await Promise.all([
        exportCtx.adminClient.from('customers').select('id, user_id, membership_id, status, joined_at').order('joined_at', { ascending: false }),
        exportCtx.adminClient.from('profiles').select('id, full_name, email, phone'),
        exportCtx.adminClient.from('loyalty_programmes').select('id, name, status'),
      ]);

      const profMap = new Map((profRes.data || []).map((p) => [p.id, p]));
      const custById = new Map((custRes.data || []).map((c) => [c.id, { ...c, profile: profMap.get(c.user_id) }]));
      const progById = new Map((progRes.data || []).map((p) => [p.id, p]));

      let columns: { key: string; label: string }[] = [];
      let rows: Record<string, unknown>[] = [];

      if (category === 'customer-registration') {
        columns = [
          { key: 'id', label: 'Customer ID' },
          { key: 'name', label: 'Customer' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'joinedOn', label: 'Join Date' },
          { key: 'status', label: 'Status' },
        ];
        rows = (custRes.data || [])
          .filter((c) => c.joined_at >= fromTs && c.joined_at <= toTs)
          .map((c) => {
            const p = profMap.get(c.user_id);
            return {
              id: c.membership_id,
              name: p?.full_name || 'Member',
              email: p?.email || '',
              phone: p?.phone || '',
              joinedOn: String(c.joined_at).slice(0, 10),
              status: c.status,
            };
          });
      } else if (category === 'purchases') {
        const purRes = await exportCtx.adminClient
          .from('purchases')
          .select('receipt_no, purchased_at, customer_id, amount_inr, is_qualifying, stamps_calculated')
          .gte('purchased_at', fromTs)
          .lte('purchased_at', toTs)
          .order('purchased_at', { ascending: false });

        columns = [
          { key: 'receiptNo', label: 'Receipt No.' },
          { key: 'dateTime', label: 'Purchased At' },
          { key: 'memberId', label: 'Member ID' },
          { key: 'memberName', label: 'Customer' },
          { key: 'amountInr', label: 'Amount (INR)' },
          { key: 'qualifying', label: 'Qualifying' },
          { key: 'stampsAwarded', label: 'Stamps' },
        ];
        rows = (purRes.data || []).map((p) => {
          const c = custById.get(p.customer_id);
          return {
            receiptNo: p.receipt_no,
            dateTime: String(p.purchased_at).slice(0, 16).replace('T', ' '),
            memberId: c?.membership_id || '',
            memberName: c?.profile?.full_name || 'Member',
            amountInr: Number(p.amount_inr || 0),
            qualifying: Boolean(p.is_qualifying),
            stampsAwarded: Number(p.stamps_calculated || 0),
          };
        });
      } else if (category === 'stamp-transactions') {
        const txRes = await exportCtx.adminClient
          .from('stamp_transactions')
          .select('transaction_code, created_at, customer_id, tx_type, stamps_delta, balance_after, status, notes')
          .gte('created_at', fromTs)
          .lte('created_at', toTs)
          .order('created_at', { ascending: false });

        columns = [
          { key: 'id', label: 'TXN ID' },
          { key: 'dateTime', label: 'Date & Time' },
          { key: 'memberId', label: 'Member ID' },
          { key: 'customerName', label: 'Customer' },
          { key: 'txType', label: 'Type' },
          { key: 'stampsAwarded', label: 'Stamps Delta' },
          { key: 'status', label: 'Status' },
        ];
        rows = (txRes.data || []).map((t) => {
          const c = custById.get(t.customer_id);
          return {
            id: t.transaction_code,
            dateTime: String(t.created_at).slice(0, 16).replace('T', ' '),
            memberId: c?.membership_id || '',
            customerName: c?.profile?.full_name || 'Member',
            txType: t.tx_type,
            stampsAwarded: t.stamps_delta,
            status: t.status,
          };
        });
      } else if (category === 'rewards') {
        const [rwRes, crRes] = await Promise.all([
          exportCtx.adminClient.from('rewards').select('*').order('required_stamps', { ascending: true }),
          exportCtx.adminClient.from('customer_rewards').select('reward_id, status').gte('unlocked_at', fromTs).lte('unlocked_at', toTs),
        ]);
        columns = [
          { key: 'code', label: 'Code' },
          { key: 'title', label: 'Reward Title' },
          { key: 'type', label: 'Type' },
          { key: 'requiredStamps', label: 'Required Stamps' },
          { key: 'status', label: 'Status' },
          { key: 'unlockedCount', label: 'Unlocked Count' },
        ];
        rows = (rwRes.data || []).map((rw) => ({
          code: rw.code,
          title: rw.title,
          type: rw.reward_type,
          requiredStamps: rw.required_stamps,
          status: rw.status,
          unlockedCount: (crRes.data || []).filter((x) => x.reward_id === rw.id).length,
        }));
      } else if (category === 'redemptions') {
        const [rdmRes, rwRes] = await Promise.all([
          exportCtx.adminClient
            .from('redemptions')
            .select('voucher_code, customer_id, reward_id, stamps_cost, status, requested_at, processed_at')
            .gte('requested_at', fromTs)
            .lte('requested_at', toTs)
            .order('requested_at', { ascending: false }),
          exportCtx.adminClient.from('rewards').select('id, title'),
        ]);
        const rwById = new Map((rwRes.data || []).map((r) => [r.id, r.title]));
        columns = [
          { key: 'voucherCode', label: 'Voucher Code' },
          { key: 'memberId', label: 'Member ID' },
          { key: 'customerName', label: 'Customer' },
          { key: 'rewardTitle', label: 'Reward' },
          { key: 'stampsCost', label: 'Stamps' },
          { key: 'status', label: 'Status' },
        ];
        rows = (rdmRes.data || []).map((r) => {
          const c = custById.get(r.customer_id);
          return {
            voucherCode: r.voucher_code,
            memberId: c?.membership_id || '',
            customerName: c?.profile?.full_name || 'Member',
            rewardTitle: rwById.get(r.reward_id) || 'Reward',
            stampsCost: r.stamps_cost,
            status: r.status,
          };
        });
      } else if (category === 'staff-activity') {
        const [stfRes, roleRes, txRes, rdmRes] = await Promise.all([
          exportCtx.adminClient.from('staff').select('id, user_id, staff_code, role_id, status'),
          exportCtx.adminClient.from('roles').select('id, name'),
          exportCtx.adminClient.from('stamp_transactions').select('staff_id, stamps_delta').gte('created_at', fromTs).lte('created_at', toTs),
          exportCtx.adminClient.from('redemptions').select('verified_by_staff_id').gte('processed_at', fromTs).lte('processed_at', toTs),
        ]);
        const roleMap = new Map((roleRes.data || []).map((r) => [r.id, r.name]));
        columns = [
          { key: 'id', label: 'Staff ID' },
          { key: 'name', label: 'Staff Name' },
          { key: 'role', label: 'Role' },
          { key: 'stampsIssuedCount', label: 'Stamps Issued' },
          { key: 'redemptionsVerifiedCount', label: 'Redemptions Verified' },
        ];
        rows = (stfRes.data || []).map((s) => ({
          id: s.staff_code,
          name: profMap.get(s.user_id)?.full_name || s.staff_code,
          role: roleMap.get(s.role_id) || 'Staff',
          stampsIssuedCount: (txRes.data || []).filter((t) => t.staff_id === s.id).reduce((sum, t) => sum + Number(t.stamps_delta || 0), 0),
          redemptionsVerifiedCount: (rdmRes.data || []).filter((r) => r.verified_by_staff_id === s.id).length,
        }));
      } else if (category === 'programme-performance') {
        const { data: analyticsData } = await exportCtx.adminClient.rpc('fn_analytics_summary', {
          p_start_date: dateFrom,
          p_end_date: dateTo,
        });
        columns = [
          { key: 'name', label: 'Programme' },
          { key: 'members', label: 'Members' },
          { key: 'stamps', label: 'Stamps Issued' },
          { key: 'redemptionRate', label: 'Redemption Rate' },
        ];
        rows = analyticsData?.programmePerformance || [];
      } else {
        // customer-activity default
        const [cardsRes, purRes, rdmRes] = await Promise.all([
          exportCtx.adminClient.from('loyalty_cards').select('customer_id, programme_id, current_stamps'),
          exportCtx.adminClient.from('purchases').select('customer_id, amount_inr, is_qualifying').gte('purchased_at', fromTs).lte('purchased_at', toTs),
          exportCtx.adminClient.from('redemptions').select('customer_id, status').gte('processed_at', fromTs).lte('processed_at', toTs),
        ]);
        columns = [
          { key: 'id', label: 'Member ID' },
          { key: 'name', label: 'Customer' },
          { key: 'programme', label: 'Programme' },
          { key: 'stamps', label: 'Stamp Balance' },
          { key: 'rewardsRedeemed', label: 'Rewards Redeemed' },
          { key: 'totalSpendInr', label: 'Total Spend (INR)' },
        ];
        rows = (custRes.data || []).map((c) => {
          const p = profMap.get(c.user_id);
          const cards = (cardsRes.data || []).filter((x) => x.customer_id === c.id);
          const primaryCard = cards[0];
          const prog = primaryCard ? progById.get(primaryCard.programme_id) : null;
          const totalSpendInr = (purRes.data || [])
            .filter((x) => x.customer_id === c.id && x.is_qualifying)
            .reduce((sum, x) => sum + Number(x.amount_inr || 0), 0);
          const rewardsRedeemed = (rdmRes.data || []).filter((x) => x.customer_id === c.id && x.status === 'completed').length;
          return {
            id: c.membership_id,
            name: p?.full_name || 'Member',
            programme: prog?.name || 'Classic Stamps',
            stamps: Number(primaryCard?.current_stamps || 0),
            rewardsRedeemed,
            totalSpendInr,
          };
        });
      }

      if (action === 'export_csv') {
        const csvHeaders = columns.map((c) => c.label);
        const csvBody = rows.map((r) => columns.map((c) => r[c.key] ?? ''));
        const csv = buildSafeCsv(csvHeaders, csvBody);

        await exportCtx.adminClient.from('audit_logs').insert({
          actor_staff_id: exportCtx.staff.id,
          action: 'report.exported',
          entity_type: 'reports',
          metadata: { category, dateFrom, dateTo, rowCount: rows.length },
        });

        return jsonResponse(
          {
            ok: true,
            filename: `bonfree-hub-${category}-${dateFrom}-to-${dateTo}.csv`,
            rowCount: rows.length,
            columns,
            csv,
          },
          200,
        );
      }

      const startIdx = (page - 1) * pageSize;
      return jsonResponse(
        {
          ok: true,
          columns,
          rows: rows.slice(startIdx, startIdx + pageSize),
          totalItems: rows.length,
          page,
          pageSize,
        },
        200,
      );
    }

    return jsonResponse({ ok: false, code: 'INVALID_ACTION', message: 'Unsupported analytics action.' }, 400);
  } catch (err) {
    return jsonResponse({ ok: false, code: 'SERVER_ERROR', message: String(err) }, 500);
  }
});
