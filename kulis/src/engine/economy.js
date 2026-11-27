// Cash, ledger, monthly income/expenses, loan and bankruptcy rule.
import { BAL } from './constants.js';
import { myClients, officeUpkeep, commissionPct } from './selectors.js';

function entry(S) {
  const t = S.time;
  let e = S.ledger[0];
  if (!e || e.season !== t.season || e.month !== t.month) {
    e = { season: t.season, month: t.month, items: [], net: 0 };
    S.ledger.unshift(e);
    if (S.ledger.length > BAL.econ.ledgerMax) S.ledger.length = BAL.econ.ledgerMax;
  }
  return e;
}
function book(S, amt, k, label) {
  const e = entry(S);
  e.items.push({ k, label, amt });
  e.net += amt;
  S.agency.cash += amt;
}

/** Pay `amt` € (cash may go negative; callers check canAfford first). Booked in this month's ledger. */
export function spend(S, amt, k, label) {
  amt = Math.round(amt);
  if (amt <= 0) return;
  book(S, -amt, k, label);
}
/** Receive `amt` €. Counts toward stats.commission for k 'commission' | 'wagecut'. */
export function earn(S, amt, k, label) {
  amt = Math.round(amt);
  if (amt <= 0) return;
  book(S, amt, k, label);
  if (k === 'commission' || k === 'wagecut') S.agency.stats.commission += amt;
}
/**
 * Change reputation. Gains shrink as rep grows (BAL.rep.decay: ×(1 − rep/decay), floor BAL.rep.floor); losses are not scaled.
 * Returns the actual change.
 */
export function addRep(S, amt) {
  const A = S.agency, R = BAL.rep;
  const k = amt > 0 ? Math.max(R.floor, 1 - A.rep / R.decay) : 1;
  const before = A.rep;
  A.rep = Math.min(100, Math.max(0, A.rep + amt * k));
  return Math.round((A.rep - before) * 10) / 10;
}
/** Spend energy; returns false (and spends nothing) if not enough. */
export function spendEnergy(S, n) {
  if (S.agency.energy < n) return false;
  S.agency.energy -= n;
  return true;
}

/**
 * Month-end money: commission cut of clients' wages, office upkeep, loan instalment,
 * negative-cash counter, one-time loan offer, bankruptcy (3 consecutive negative month-ends).
 * @returns {{items:object[], net:number, cash:number, bankrupt:boolean, loanOffer:boolean}}
 */
export function monthlyEconomy(S) {
  const A = S.agency;
  const clients = myClients(S);
  let cut = 0;
  for (const p of clients) cut += p.wage * commissionPct(S) / 100;
  if (cut > 0) earn(S, cut, 'wagecut', 'Müşteri komisyonları (' + clients.length + ')');
  spend(S, officeUpkeep(S), 'upkeep', 'Ofis gideri');
  if (A.loan) {
    spend(S, A.loan.monthly, 'loan', 'Kredi taksiti');
    A.loan.monthsLeft--;
    if (A.loan.monthsLeft <= 0) A.loan = null;
  }
  let loanOffer = false, bankrupt = false;
  if (A.cash < 0) {
    A.negMonths++;
    if (!A.loanOffered) { A.loanOffered = true; loanOffer = true; S.flags.loanOfferPending = true; }
    if (A.negMonths >= BAL.econ.negMonthsBankrupt) bankrupt = true;
  } else A.negMonths = 0;
  const e = entry(S);
  return { items: e.items.slice(), net: e.net, cash: A.cash, bankrupt, loanOffer };
}

/** Accept the one-time bank loan (only after the offer flag was raised). */
export function takeLoan(S) {
  const A = S.agency, L = BAL.econ.loan;
  if (!A.loanOffered) return { ok: false, error: 'Banka teklifi yok' };
  if (A.loan) return { ok: false, error: 'Zaten bir krediniz var' };
  A.loan = { principal: L.amount, monthly: Math.ceil(L.amount * (1 + L.rate) / L.months), monthsLeft: L.months };
  book(S, L.amount, 'loan', 'Banka kredisi');
  S.flags.loanOfferPending = false;
  return { ok: true, events: [{ type: 'loan', amount: L.amount, monthly: A.loan.monthly, months: L.months }] };
}
