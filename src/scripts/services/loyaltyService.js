/**
 * BONFREE-HUB Customer Loyalty Service & Supabase Queries (Phase 4)
 *
 * Security & Architecture Rules:
 * - When Supabase is not configured, returns clearly flagged `DEV_MEMBER_FIXTURE` (read-only).
 * - When Supabase IS configured, queries real RLS-protected records via `restSelect` / `restUpdate` / `invokeEdgeFunction`.
 * - Customers can NEVER mutate stamp balances, membership IDs, status, or reward eligibility.
 */
import { isProductionEnvironment, isSupabaseConfigured } from '../core/config.js';
import {
  invokeEdgeFunction,
  restInsert,
  restRpc,
  restSelect,
  restUpdate,
  supabaseAuth,
} from '../core/supabaseClient.js';

export const DEV_MEMBER_FIXTURE = Object.freeze({
  isDevelopmentFixture: true,
  member: Object.freeze({
    id: 'dev-member-001',
    fullName: 'Aanya Sharma',
    firstName: 'Aanya',
    membershipCode: 'BF-001248',
    qrToken: 'BFQR-001248A9C4E2',
    email: 'aanya.sharma@bonfree-member.dev',
    mobile: '+91 98765 43210',
    birthMonth: 8,
    joinedDate: '12 Oct 2024',
    programmeName: 'Classic Stamps',
    programmeRule: '₹1,000 = 1 Stamp',
    stampGoal: 10,
    collectedStamps: 7,
    stampExpiryNote: 'Stamps valid for 12 months from purchase date',
  }),
  cards: Object.freeze([
    {
      id: 'card-classic-1',
      programmeId: 'prog-classic',
      programmeName: 'Classic Stamps',
      programmeRule: '₹1,000 = 1 Stamp',
      stampGoal: 10,
      collectedStamps: 7,
      lifetimeStamps: 17,
      status: 'active',
      isProgrammeValid: true,
      expiryNote: 'Stamps valid for 12 months from purchase date',
    },
    {
      id: 'card-premium-1',
      programmeId: 'prog-premium',
      programmeName: 'Premium Circle',
      programmeRule: '₹2,500 = 1 Stamp',
      stampGoal: 10,
      collectedStamps: 10,
      lifetimeStamps: 10,
      status: 'completed',
      isProgrammeValid: true,
      expiryNote: 'Card completed — signature reward unlocked',
    },
  ]),
  rewards: Object.freeze([
    {
      id: 'rw-avail-1',
      title: '₹250 Member Drop Credit',
      description: 'Valid on oversized tees, boxy shirts, and cropped tops.',
      requiredStamps: 5,
      status: 'available',
      voucherCode: null,
      validityText: 'Redeem anytime while balance >= 5 stamps',
    },
    {
      id: 'rw-avail-2',
      title: 'Priority Alteration & Care Pass',
      description: 'Complimentary denim & cargo hemming at flagship stores.',
      requiredStamps: 3,
      status: 'available',
      voucherCode: null,
      validityText: 'Member perk unlocked at 3 stamps',
    },
    {
      id: 'rw-lock-1',
      title: '₹500 BONFREE-HUB Voucher',
      description: 'Signature 10-stamp reward valid storewide on all Gen Z streetwear.',
      requiredStamps: 10,
      status: 'locked',
      voucherCode: null,
      validityText: 'Valid 6 months once unlocked & redeemed',
    },
    {
      id: 'rw-lock-2',
      title: 'Early Capsule Access Pass',
      description: '48-hour private preview for limited outerwear & denim drops.',
      requiredStamps: 10,
      status: 'locked',
      voucherCode: null,
      validityText: 'Unlocks at 10 stamps',
    },
    {
      id: 'rw-red-1',
      title: '₹500 BONFREE-HUB Voucher',
      description: 'Applied on Relaxed Cargo Pants order.',
      requiredStamps: 10,
      status: 'redeemed',
      voucherCode: 'BFH-VCH-4821',
      redeemedAt: '12 Jan 2025',
      validityText: 'Redeemed in-store',
    },
    {
      id: 'rw-red-2',
      title: '₹250 Member Drop Credit',
      description: 'Applied on Heavyweight Graphic Tee.',
      requiredStamps: 5,
      status: 'redeemed',
      voucherCode: 'BFH-VCH-3190',
      redeemedAt: '18 Aug 2024',
      validityText: 'Redeemed in-store',
    },
  ]),
  stampActivity: Object.freeze([
    {
      id: 'st-1',
      date: '12 Jan 2025',
      title: 'Stamp Earned — Oversized Graphic Tee',
      receiptNo: 'BFH-250112-0142',
      programme: 'Classic Stamps',
      delta: '+1',
      balanceAfter: 7,
      type: 'earned',
      amountInr: 1499,
    },
    {
      id: 'st-2',
      date: '05 Nov 2024',
      title: 'Stamp Earned — Relaxed Cargo Pants',
      receiptNo: 'BFH-241105-0089',
      programme: 'Classic Stamps',
      delta: '+1',
      balanceAfter: 6,
      type: 'earned',
      amountInr: 2299,
    },
    {
      id: 'st-3',
      date: '18 Aug 2024',
      title: 'Stamp Earned — Boxy Oxford Shirt',
      receiptNo: 'BFH-240818-0211',
      programme: 'Classic Stamps',
      delta: '+1',
      balanceAfter: 5,
      type: 'earned',
      amountInr: 1799,
    },
    {
      id: 'st-4',
      date: '22 Jun 2024',
      title: 'Stamp Earned — Baggy Raw Denim Jeans',
      receiptNo: 'BFH-240622-0047',
      programme: 'Classic Stamps',
      delta: '+2',
      balanceAfter: 4,
      type: 'earned',
      amountInr: 3199,
    },
    {
      id: 'st-5',
      date: '12 Jan 2025',
      title: 'Voucher Issued — ₹500 Store Reward',
      receiptNo: 'BFH-VCH-4821',
      programme: 'Classic Stamps',
      delta: '-10',
      balanceAfter: 6,
      type: 'redeemed',
      amountInr: null,
    },
  ]),
  purchases: Object.freeze([
    {
      id: 'pur-1',
      receiptNo: 'BFH-250112-0142',
      date: '12 Jan 2025',
      itemName: 'Oversized Graphic Tee (Washed Charcoal)',
      category: 'Oversized Tees',
      store: 'Bengaluru — MG Road',
      amountInr: 1499,
      qualifying: true,
      stampsAwarded: 1,
    },
    {
      id: 'pur-2',
      receiptNo: 'BFH-241105-0089',
      date: '05 Nov 2024',
      itemName: 'Relaxed Utility Cargo Pants (Slate)',
      category: 'Cargo Pants',
      store: 'Bengaluru — MG Road',
      amountInr: 2299,
      qualifying: true,
      stampsAwarded: 1,
    },
    {
      id: 'pur-3',
      receiptNo: 'BFH-240818-0211',
      date: '18 Aug 2024',
      itemName: 'Boxy Cropped Poplin Shirt (Ivory)',
      category: 'Trendy Shirts',
      store: 'Mumbai — Bandra',
      amountInr: 1799,
      qualifying: true,
      stampsAwarded: 1,
    },
    {
      id: 'pur-4',
      receiptNo: 'BFH-240622-0047',
      date: '22 Jun 2024',
      itemName: 'Baggy Raw Denim Jeans + Layered Overshirt',
      category: 'Denim & Shirts',
      store: 'Bengaluru — MG Road',
      amountInr: 3199,
      qualifying: true,
      stampsAwarded: 2,
    },
    {
      id: 'pur-5',
      receiptNo: 'BFH-240410-0019',
      date: '10 Apr 2024',
      itemName: 'Ribbed Crop Top (Monochrome Black)',
      category: 'Tops',
      store: 'Bengaluru — MG Road',
      amountInr: 799,
      qualifying: false,
      stampsAwarded: 0,
    },
  ]),
  campaigns: Object.freeze([
    {
      id: 'camp-1',
      title: 'New Drop Rewards',
      description: 'Earn 2x loyalty stamps on new drop streetwear — oversized tees, cargos, baggy jeans and more.',
      image: 'assets/images/hero-streetwear.jpg',
      programmeId: 'prog-classic',
      programmeName: 'Classic Stamps',
      multiplier: 2,
      bonusStamps: 0,
      rule: '2x Stamp Multiplier on New Arrivals',
      startDate: '2026-11-01',
      endDate: '2026-12-31',
      status: 'active',
    },
    {
      id: 'camp-2',
      title: 'Denim Days',
      description: 'Special rewards on denim — baggy jeans, relaxed fits and new washes for a modern everyday look.',
      image: 'assets/images/streetwear-editorial.jpg',
      programmeId: 'prog-classic',
      programmeName: 'Classic Stamps',
      multiplier: 1,
      bonusStamps: 1,
      rule: '+1 Bonus Stamp on Denim Purchases >= ₹2,000',
      startDate: '2026-11-15',
      endDate: '2026-12-31',
      status: 'active',
    },
  ]),
  surveys: Object.freeze([
    {
      id: 'srv-streetwear-2025',
      title: 'Modern streetwear & everyday fashion',
      subtitle: 'Help us serve you better. Share your experience with BONFREE-HUB.',
      programmeId: null,
      status: 'published',
      submitted: false,
      questions: [
        { id: 'q1', type: 'rating', prompt: 'How would you rate your overall shopping & loyalty experience?', options: [], isRequired: true },
        { id: 'q2', type: 'multiple_choice', prompt: 'What do you like the most about our collections?', options: ['Oversized tees & casual basics', 'Trendy boxy shirts', 'Cargos & baggy jeans', 'Layered jackets & crop tops'], isRequired: true },
        { id: 'q3', type: 'short_answer', prompt: 'Which streetwear fit or colourway should we restock next?', options: [], isRequired: true },
        { id: 'q4', type: 'long_answer', prompt: 'Any suggestions to make your BONFREE-HUB loyalty rewards even better?', options: [], isRequired: false },
      ],
    },
  ]),
  preferences: Object.freeze({
    earlyAccessDrops: true,
    birthdayOffers: true,
    voucherExpiryAlerts: true,
    smsStampReceipts: false,
  }),
});

export function isCampaignCurrentlyValid(camp, enrolledProgrammeIds = null, nowDate = new Date()) {
  if (!camp) return false;
  if (String(camp.status || '').toLowerCase() !== 'active') return false;
  const todayIso = nowDate.toISOString().slice(0, 10);
  const start = camp.start_date || camp.startDate;
  const end = camp.end_date || camp.endDate;
  if (start && String(start) > todayIso) return false;
  if (end && String(end) < todayIso) return false;
  const progId = camp.programme_id ?? camp.programmeId ?? null;
  if (progId && enrolledProgrammeIds && !enrolledProgrammeIds.has(progId)) {
    return false;
  }
  return true;
}

function formatDateLabel(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function isProgrammeCurrentlyValid(prog, nowDate = new Date()) {
  if (!prog) return false;
  const statusOk = String(prog.status || '').toLowerCase() === 'active';
  if (!statusOk) return false;
  const nowMs = nowDate.getTime();
  if (prog.starts_at && new Date(prog.starts_at).getTime() > nowMs) return false;
  if (prog.expires_at && new Date(prog.expires_at).getTime() < nowMs) return false;
  return true;
}

/**
 * Computes the next available or unlocked reward for a card's collected stamp balance.
 */
export function computeNextAvailableReward(collectedStamps = 0, rewards = [], programmeId = null) {
  const candidates = rewards
    .filter(
      (r) =>
        (r.status === 'available' || r.status === 'locked') &&
        (!programmeId || !r.programmeId || r.programmeId === programmeId),
    )
    .sort((a, b) => a.requiredStamps - b.requiredStamps);

  if (candidates.length === 0) {
    return {
      type: 'none',
      reward: null,
      stampsRemaining: 0,
      message: 'Check My Rewards for active member offers.',
    };
  }

  const upcoming = candidates.find((r) => r.requiredStamps > collectedStamps);
  if (upcoming) {
    const remaining = upcoming.requiredStamps - collectedStamps;
    return {
      type: 'upcoming',
      reward: upcoming,
      stampsRemaining: remaining,
      message: `Collect ${remaining} more ${remaining === 1 ? 'stamp' : 'stamps'} to unlock ${upcoming.title}`,
    };
  }

  const highestUnlocked = candidates[candidates.length - 1];
  return {
    type: 'unlocked',
    reward: highestUnlocked,
    stampsRemaining: 0,
    message: `${highestUnlocked.title} is unlocked and ready to redeem!`,
  };
}

/**
 * Fetches live member records from RLS-protected Supabase tables (or read-only dev fixture when unconfigured).
 */
export async function fetchCustomerPortalData() {
  if (!isSupabaseConfigured()) {
    if (isProductionEnvironment()) {
      return {
        ok: false,
        code: 'SUPABASE_NOT_CONFIGURED',
        message: 'Customer portal service is unavailable until backend environment variables are configured.',
      };
    }
    return {
      ok: true,
      source: 'development-fixture',
      data: DEV_MEMBER_FIXTURE,
    };
  }

  const sessionCheck = await supabaseAuth.getValidSession();
  if (!sessionCheck.ok) {
    return sessionCheck;
  }

  const userRes = await supabaseAuth.getUser();
  if (!userRes.ok || !userRes.data?.id) {
    return { ok: false, code: 'SESSION_EXPIRED', message: 'Your session has expired. Please sign in again.' };
  }

  const uid = userRes.data.id;
  // Auto-assign eligible active loyalty cards (0-stamp initialization only)
  await restRpc('sync_my_loyalty_cards').catch(() => {});

  const [profileRes, customerRes] = await Promise.all([
    restSelect('profiles', `select=id,full_name,email,phone&id=eq.${uid}`),
    restSelect('customers', `select=id,membership_id,qr_token,status,birth_month,preferences,joined_at&user_id=eq.${uid}`),
  ]);

  if (!profileRes.ok) return profileRes;
  if (!customerRes.ok) return customerRes;

  const profile = profileRes.data?.[0];
  const customer = customerRes.data?.[0];
  if (!profile || !customer) {
    return { ok: false, code: 'CUSTOMER_NOT_FOUND', message: 'Customer profile could not be located.' };
  }

  const cid = customer.id;
  const [cardsRes, rewardsRes, custRewardsRes, txRes, purchasesRes, campaignsRes, surveysRes, surveyRespRes] = await Promise.all([
    restSelect('loyalty_cards', `select=*,loyalty_programmes(*)&customer_id=eq.${cid}&order=current_stamps.desc`),
    restSelect('rewards', 'select=*&status=eq.active&order=required_stamps.asc'),
    restSelect('customer_rewards', `select=*,rewards(title,description,required_stamps)&customer_id=eq.${cid}&order=created_at.desc`),
    restSelect('stamp_transactions', `select=*&customer_id=eq.${cid}&order=created_at.desc&limit=25`),
    restSelect('purchases', `select=*,stores(name)&customer_id=eq.${cid}&order=purchased_at.desc&limit=25`),
    restSelect('campaigns', 'select=*,loyalty_programmes(id,name)&status=eq.active&order=start_date.desc'),
    restSelect('surveys', 'select=id,title,subtitle,eligible_programme_id,status,published_at,survey_questions(id,question_type,prompt,options,sort_order,is_required)&status=eq.published&order=published_at.desc'),
    restSelect('survey_responses', `select=id,survey_id,overall_rating,submitted_at&customer_id=eq.${cid}`),
  ]);

  const cards = (cardsRes.data || []).map((c) => {
    const prog = c.loyalty_programmes || {};
    const validNow = isProgrammeCurrentlyValid(prog);
    const goal = Number(prog.stamp_goal || 10);
    const collected = Number(c.current_stamps || 0);
    const derivedStatus = !validNow
      ? 'expired'
      : c.status === 'suspended'
      ? 'suspended'
      : collected >= goal
      ? 'completed'
      : 'active';

    return {
      id: c.id,
      programmeId: prog.id || c.programme_id,
      programmeName: prog.name || 'Classic Stamps',
      programmeRule: prog.qualifying_amount_inr
        ? `₹${Number(prog.qualifying_amount_inr).toLocaleString('en-IN')} = 1 Stamp`
        : '₹1,000 = 1 Stamp',
      stampGoal: goal,
      collectedStamps: collected,
      lifetimeStamps: Number(c.lifetime_stamps || collected),
      status: derivedStatus,
      isProgrammeValid: validNow,
      expiryNote: `Stamps valid for ${prog.stamp_validity_months || 12} months`,
    };
  });

  const primaryCard = cards[0] || {
    id: 'default-card',
    programmeId: null,
    programmeName: 'Classic Stamps',
    programmeRule: '₹1,000 = 1 Stamp',
    stampGoal: 10,
    collectedStamps: 0,
    lifetimeStamps: 0,
    status: 'active',
    isProgrammeValid: true,
    expiryNote: 'Stamps valid for 12 months',
  };

  const collectedStamps = primaryCard.collectedStamps;
  const stampGoal = primaryCard.stampGoal;
  const firstName = String(profile.full_name || 'Member').trim().split(/\s+/)[0];
  const currentMonth = new Date().getMonth() + 1;

  const custRewardsRows = Array.isArray(custRewardsRes.data) ? custRewardsRes.data : [];

  const catalogRewards = (rewardsRes.data || []).map((rw) => {
    const matchingCard =
      (rw.programme_id
        ? cards.find((c) => c.programmeId === rw.programme_id)
        : cards.find((c) => c.isProgrammeValid) || primaryCard) || primaryCard;

    const cardStamps = Number(matchingCard.collectedStamps || 0);
    const cardLifetime = Number(matchingCard.lifetimeStamps || 0);
    const cfg = rw.eligibility_config || {};
    const bdayOnly = rw.reward_type === 'Birthday Reward' || Boolean(cfg.birthday_month_only);
    const minLifetime = Number(cfg.min_lifetime_stamps || 0);

    const claimsForReward = custRewardsRows.filter(
      (cr) => cr.reward_id === rw.id && (cr.status === 'pending' || cr.status === 'redeemed'),
    );
    const limitReached =
      rw.redemption_limit_per_member != null && claimsForReward.length >= Number(rw.redemption_limit_per_member);
    const hasPending = claimsForReward.some((cr) => cr.status === 'pending');
    const hasUnlockedRow = custRewardsRows.some((cr) => cr.reward_id === rw.id && cr.status === 'available');

    const bdayOk = !bdayOnly || Number(customer.birth_month) === currentMonth;
    const lifetimeOk = minLifetime <= 0 || cardLifetime >= minLifetime;
    const stampsOk = cardStamps >= Number(rw.required_stamps || 0);
    const programmeOk = Boolean(matchingCard.isProgrammeValid);

    const isEligible = programmeOk && !limitReached && !hasPending && bdayOk && lifetimeOk && (stampsOk || hasUnlockedRow);

    let lockReason = '';
    if (hasPending) lockReason = 'Voucher already active — show pending voucher at checkout.';
    else if (limitReached) lockReason = `Redemption limit reached (${rw.redemption_limit_label || 'Limit met'}).`;
    else if (!bdayOk) lockReason = 'Available exclusively during your registered birth month.';
    else if (!lifetimeOk) lockReason = `Requires ${minLifetime} lifetime stamps.`;
    else if (!programmeOk) lockReason = 'Associated loyalty programme is inactive or expired.';
    else if (!stampsOk) {
      const need = Math.max(1, Number(rw.required_stamps || 0) - cardStamps);
      lockReason = `Need ${need} more ${need === 1 ? 'stamp' : 'stamps'} to unlock`;
    }

    return {
      id: rw.id,
      programmeId: rw.programme_id || null,
      programmeName: matchingCard.programmeName || 'All Programmes',
      cardStamps,
      title: rw.title,
      rewardType: rw.reward_type,
      valueLabel: rw.value_label,
      description: rw.description,
      requiredStamps: rw.required_stamps,
      eligibilityRule: rw.eligibility_rule || '',
      redemptionLimitLabel: rw.redemption_limit_label || '',
      status: isEligible ? 'available' : 'locked',
      lockReason,
      voucherCode: null,
      validityText: `Valid ${rw.validity_months} months once requested`,
    };
  });

  const voucherHistory = custRewardsRows
    .filter((cr) => cr.status !== 'available')
    .map((cr) => {
      const normalized =
        cr.status === 'pending'
          ? 'pending'
          : cr.status === 'expired'
          ? 'expired'
          : cr.status === 'rejected'
          ? 'rejected'
          : 'redeemed';
      return {
        id: cr.id,
        rewardId: cr.reward_id,
        title: cr.rewards?.title || 'Loyalty Reward',
        description: cr.rewards?.description || '',
        requiredStamps: cr.stamps_spent,
        status: normalized,
        voucherCode: cr.voucher_code,
        redeemedAt: formatDateLabel(cr.redeemed_at || cr.created_at),
        expiresAt: formatDateLabel(cr.expires_at),
        validityText:
          normalized === 'pending'
            ? `Active Checkout Voucher · Expires ${formatDateLabel(cr.expires_at)}`
            : normalized === 'expired'
            ? `Expired on ${formatDateLabel(cr.expires_at)}`
            : normalized === 'rejected'
            ? 'Rejected (stamps refunded to balance)'
            : `Redeemed on ${formatDateLabel(cr.redeemed_at || cr.created_at)}`,
      };
    });

  const stampActivity = (txRes.data || []).map((tx) => ({
    id: tx.id,
    date: formatDateLabel(tx.created_at),
    title: tx.notes || `Stamp ${tx.tx_type}`,
    receiptNo: tx.transaction_code,
    programme: primaryCard.programmeName,
    delta: tx.stamps_delta > 0 ? `+${tx.stamps_delta}` : String(tx.stamps_delta),
    balanceAfter: tx.balance_after,
    type: tx.tx_type,
    amountInr: null,
  }));

  const purchases = (purchasesRes.data || []).map((p) => ({
    id: p.id,
    receiptNo: p.receipt_no,
    date: formatDateLabel(p.purchased_at),
    itemName: p.items_summary || 'BONFREE-HUB Purchase',
    category: 'Streetwear',
    store: p.stores?.name || 'Flagship Store',
    amountInr: Number(p.amount_inr || 0),
    qualifying: Boolean(p.is_qualifying),
    stampsAwarded: Number(p.stamps_calculated || 0),
  }));

  const enrolledProgrammeIds = new Set(cards.map((c) => c.programmeId).filter(Boolean));
  const campaigns = (campaignsRes.ok && Array.isArray(campaignsRes.data) ? campaignsRes.data : [])
    .filter((c) => isCampaignCurrentlyValid(c, enrolledProgrammeIds))
    .map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description || '',
      image: c.image_path || 'assets/images/hero-streetwear.jpg',
      programmeId: c.programme_id || null,
      programmeName: c.loyalty_programmes?.name || 'All Active Programmes',
      multiplier: Number(c.multiplier || 1),
      bonusStamps: Number(c.bonus_stamps || 0),
      rule: c.promotional_rule || `${Number(c.multiplier || 1)}x Stamps`,
      startDate: formatDateLabel(c.start_date),
      endDate: formatDateLabel(c.end_date),
      status: 'active',
    }));

  const submittedSurveyIds = new Set(
    (surveyRespRes.ok && Array.isArray(surveyRespRes.data) ? surveyRespRes.data : []).map((r) => r.survey_id),
  );
  const surveys = (surveysRes.ok && Array.isArray(surveysRes.data) ? surveysRes.data : [])
    .filter((sv) => !sv.eligible_programme_id || enrolledProgrammeIds.has(sv.eligible_programme_id))
    .map((sv) => ({
      id: sv.id,
      title: sv.title,
      subtitle: sv.subtitle || '',
      programmeId: sv.eligible_programme_id || null,
      status: sv.status,
      submitted: submittedSurveyIds.has(sv.id),
      questions: (sv.survey_questions || [])
        .slice()
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
        .map((q) => ({
          id: q.id,
          type: q.question_type,
          prompt: q.prompt,
          options: Array.isArray(q.options) ? q.options : [],
          isRequired: q.is_required !== false,
        })),
    }));

  return {
    ok: true,
    source: 'supabase-live',
    data: {
      isDevelopmentFixture: false,
      member: {
        id: customer.id,
        fullName: profile.full_name,
        firstName,
        membershipCode: customer.membership_id,
        qrToken: customer.qr_token,
        email: profile.email,
        mobile: profile.phone || '',
        birthMonth: customer.birth_month || '',
        joinedDate: formatDateLabel(customer.joined_at),
        programmeName: primaryCard.programmeName,
        programmeRule: primaryCard.programmeRule,
        stampGoal,
        collectedStamps,
        stampExpiryNote: primaryCard.expiryNote,
      },
      cards: cards.length > 0 ? cards : [primaryCard],
      rewards: [...catalogRewards, ...voucherHistory],
      stampActivity,
      purchases,
      campaigns,
      surveys,
      preferences: customer.preferences || DEV_MEMBER_FIXTURE.preferences,
    },
  };
}

/**
 * Updates allowed customer profile fields (`full_name`, `phone`, `birth_month`).
 * Protected fields (`membership_id`, `email`, `status`) are guarded by PostgreSQL triggers & RLS.
 */
export async function updateCustomerProfile({ fullName, mobile, birthMonth }) {
  if (!fullName || String(fullName).trim().length < 2) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Full name must be at least 2 characters.' };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message: 'Profile changes passed validation and will save to Supabase PostgreSQL once connected.',
    };
  }

  const userRes = await supabaseAuth.getUser();
  if (!userRes.ok || !userRes.data?.id) {
    return { ok: false, code: 'SESSION_EXPIRED', message: 'Your session has expired. Please sign in again.' };
  }

  const uid = userRes.data.id;
  const profRes = await restUpdate('profiles', `id=eq.${uid}`, {
    full_name: String(fullName).trim(),
    phone: mobile ? String(mobile).trim() : null,
  });
  if (!profRes.ok) return profRes;

  const parsedMonth = birthMonth ? Number(birthMonth) : null;
  const custRes = await restUpdate('customers', `user_id=eq.${uid}`, {
    birth_month: parsedMonth && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : null,
  });
  if (!custRes.ok) return custRes;

  return { ok: true, message: 'Profile updated successfully.' };
}

/**
 * Submits a reward redemption request to the `redeem-reward` Edge Function with idempotency protection.
 */
export async function requestRewardRedemption({ rewardId, idempotencyKey = '' }) {
  if (!rewardId) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Missing reward identifier.' };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Redemption requests execute via the Supabase Edge Function (`redeem-reward`) so stamp deductions remain tamper-proof.',
    };
  }

  const key =
    idempotencyKey ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? `rdm-${rewardId}-${crypto.randomUUID().slice(0, 8)}`
      : `rdm-${rewardId}-${Math.random().toString(36).slice(2, 10)}`);

  const edgeRes = await invokeEdgeFunction('redeem-reward', {
    mode: 'request',
    rewardId,
    idempotencyKey: key,
  });

  if (!edgeRes.ok) return edgeRes;
  const result = edgeRes.data?.result ?? edgeRes.data ?? null;
  return {
    ok: true,
    idempotentReplay: Boolean(edgeRes.data?.idempotentReplay),
    result,
    message: result?.voucher_code
      ? `Voucher ${result.voucher_code} generated! Show this code at store checkout.`
      : 'Redemption requested successfully.',
  };
}

/**
 * Updates member communication preferences (`customers.preferences` JSONB via RLS).
 */
export async function updateMemberPreferences(preferences) {
  if (!preferences || typeof preferences !== 'object') {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid preferences payload.' };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Preference updates persist to Supabase PostgreSQL once backend authentication is active.',
    };
  }

  const userRes = await supabaseAuth.getUser();
  if (!userRes.ok || !userRes.data?.id) {
    return { ok: false, code: 'SESSION_EXPIRED', message: 'Your session has expired. Please sign in again.' };
  }

  const res = await restUpdate('customers', `user_id=eq.${userRes.data.id}`, { preferences });
  if (!res.ok) return res;

  return { ok: true, message: 'Preferences saved.' };
}

export async function fetchPublishedSurvey(surveyId = null) {
  if (!isSupabaseConfigured()) {
    const devSurvey = DEV_MEMBER_FIXTURE.surveys[0];
    return { ok: true, source: 'development-fixture', survey: devSurvey };
  }

  const filter = surveyId
    ? `id=eq.${encodeURIComponent(surveyId)}&status=eq.published`
    : 'status=eq.published&order=published_at.desc&limit=1';

  const svRes = await restSelect(
    'surveys',
    `select=id,title,subtitle,eligible_programme_id,status,survey_questions(id,question_type,prompt,options,sort_order,is_required)&${filter}`,
  );
  if (!svRes.ok) return svRes;

  const sv = svRes.data?.[0];
  if (!sv) {
    return { ok: false, code: 'SURVEY_NOT_OPEN', message: 'No active published survey is currently open for responses.' };
  }

  let submitted = false;
  const sessionCheck = await supabaseAuth.getValidSession();
  if (sessionCheck.ok) {
    const respRes = await restSelect('survey_responses', `select=id&survey_id=eq.${sv.id}`);
    if (respRes.ok && Array.isArray(respRes.data) && respRes.data.length > 0) {
      submitted = true;
    }
  }

  return {
    ok: true,
    source: 'supabase-live',
    survey: {
      id: sv.id,
      title: sv.title,
      subtitle: sv.subtitle || '',
      programmeId: sv.eligible_programme_id || null,
      status: sv.status,
      submitted,
      questions: (sv.survey_questions || [])
        .slice()
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
        .map((q) => ({
          id: q.id,
          type: q.question_type,
          prompt: q.prompt,
          options: Array.isArray(q.options) ? q.options : [],
          isRequired: q.is_required !== false,
        })),
    },
  };
}

export async function submitSurveyResponse(payload) {
  if (!payload || !payload.surveyId) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Survey payload is incomplete.' };
  }

  if (payload.rating !== undefined && payload.rating !== null) {
    const ratingNum = Number(payload.rating);
    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Overall rating must be between 1 and 5 stars.' };
    }
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Thank you — your survey inputs passed validation, and response persistence activates once Supabase backend is connected.',
    };
  }

  const sessionCheck = await supabaseAuth.getValidSession();
  if (!sessionCheck.ok) {
    return {
      ok: false,
      code: sessionCheck.code || 'UNAUTHORIZED',
      message: 'Please sign in to your BONFREE-HUB member account before submitting this survey.',
    };
  }

  const res = await restRpc('fn_submit_survey_response', {
    p_survey_id: payload.surveyId,
    p_overall_rating: payload.rating ? Number(payload.rating) : null,
    p_answers: payload.answers && typeof payload.answers === 'object' ? payload.answers : payload,
  });

  if (!res.ok) {
    const rawMsg = String(res.message || '');
    if (rawMsg.includes('DUPLICATE_SURVEY_SUBMISSION') || rawMsg.includes('unique')) {
      return {
        ok: false,
        code: 'DUPLICATE_SURVEY_SUBMISSION',
        message: 'You have already submitted a response to this survey.',
      };
    }
    if (rawMsg.includes('SURVEY_NOT_OPEN')) {
      return {
        ok: false,
        code: 'SURVEY_NOT_OPEN',
        message: 'This survey has been closed or is no longer accepting submissions.',
      };
    }
    if (rawMsg.includes('SURVEY_ELIGIBILITY_NOT_MET')) {
      return {
        ok: false,
        code: 'SURVEY_ELIGIBILITY_NOT_MET',
        message: 'This survey is limited to eligible loyalty programme members.',
      };
    }
    if (rawMsg.includes('CUSTOMER_NOT_ACTIVE')) {
      return {
        ok: false,
        code: 'CUSTOMER_NOT_ACTIVE',
        message: 'Only active registered BONFREE-HUB customers can submit survey responses.',
      };
    }
    return res;
  }

  return {
    ok: true,
    responseId: res.data,
    message: 'Thank you! Your feedback has been recorded for the BONFREE-HUB team.',
  };
}
