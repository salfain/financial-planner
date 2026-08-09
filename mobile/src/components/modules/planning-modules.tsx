import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ProjectionLineChart } from '@/components/finance/charts';
import { Amount } from '@/components/ui/amount';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { FormField, MoneyInput, SelectField } from '@/components/ui/forms';
import { ProgressBar, StatusPill } from '@/components/ui/progress';
import { ErrorState, LoadingState, OfflineState } from '@/components/ui/state-view';
import { spacing } from '@/constants/theme';
import { accountTotals } from '@/domain/selectors';
import { useApp } from '@/providers/app-provider';
import { formatCurrency, formatPercent, parseMoney } from '@/utils/format';

type RoadmapSettings = { horizonMonths: number; incomeAdjustmentPct: number; expenseAdjustmentPct: number; annualInvestmentReturnPct: number; annualInflationPct: number; monthlyInvestment: number };
const ROADMAP_DEFAULT: RoadmapSettings = { horizonMonths: 24, incomeAdjustmentPct: 0, expenseAdjustmentPct: 0, annualInvestmentReturnPct: 6, annualInflationPct: 3, monthlyInvestment: 0 };

function useSettings<T extends Record<string, unknown>>(readAction: string, updateAction: string, fallback: T) {
  const { read, mutate, isMutating, isOnline } = useApp();
  const [value, setValue] = useState<T>(fallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!isOnline) { setLoading(false); return; }
    try { setValue(await read<T>(readAction)); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Pengaturan gagal dimuat.'); } finally { setLoading(false); }
  }, [isOnline, read, readAction]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  const save = async () => { try { setValue(await mutate<T>(updateAction, value).then((result) => result.data ?? value)); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Pengaturan gagal disimpan.'); } };
  return { value, setValue, loading, error, load, save, isMutating, isOnline };
}

const numeric = <T extends Record<string, unknown>>(setValue: (next: T | ((value: T) => T)) => void, key: keyof T, raw: string) => setValue((value) => ({ ...value, [key]: Number(raw || 0) }));

export function RoadmapModule() {
  const { snapshot } = useApp();
  const state = useSettings('getRoadmapSettings', 'updateRoadmapSettings', ROADMAP_DEFAULT as unknown as Record<string, unknown>);
  const settings = state.value as unknown as RoadmapSettings;
  const { netWorth } = accountTotals(snapshot?.accounts ?? []);
  const projections = useMemo(() => {
    const baseIncome = (snapshot?.summary.income ?? 0) * (1 + settings.incomeAdjustmentPct / 100);
    const baseExpense = (snapshot?.summary.expense ?? 0) * (1 + settings.expenseAdjustmentPct / 100);
    const monthlyReturn = settings.annualInvestmentReturnPct / 100 / 12;
    const create = (factor: number) => {
      let worth = netWorth;
      return Array.from({ length: settings.horizonMonths + 1 }, (_, month) => {
        if (month) worth = worth * (1 + monthlyReturn * factor) + (baseIncome - baseExpense) * factor + settings.monthlyInvestment;
        return worth;
      });
    };
    return [{ label: 'Konservatif', values: create(0.8), color: '#d89832' }, { label: 'Utama', values: create(1), color: '#126b59' }, { label: 'Optimistis', values: create(1.2), color: '#4e79c7' }];
  }, [netWorth, settings, snapshot?.summary.expense, snapshot?.summary.income]);
  if (state.loading) return <LoadingState />;
  return <View style={{ gap: spacing.md }}>{!state.isOnline ? <OfflineState /> : null}{state.error ? <ErrorState message={state.error} onRetry={() => void state.load()} /> : null}<Card style={{ gap: spacing.sm }}><AppText variant="title">Proyeksi net worth</AppText><ProjectionLineChart series={projections} /><Amount value={projections[1].values.at(-1) ?? netWorth} variant="amount" /><AppText variant="caption" muted>Estimasi skenario utama pada bulan ke-{settings.horizonMonths}.</AppText></Card><Card style={{ gap: spacing.md }}><SelectField label="Horizon" value={String(settings.horizonMonths)} onChange={(raw) => numeric(state.setValue, 'horizonMonths', raw)} options={[12, 24, 36, 60].map((value) => ({ label: `${value} bulan`, value: String(value) }))} /><FormField label="Perubahan pemasukan (%)" value={String(settings.incomeAdjustmentPct)} onChangeText={(raw) => numeric(state.setValue, 'incomeAdjustmentPct', raw)} keyboardType="numbers-and-punctuation" /><FormField label="Perubahan pengeluaran (%)" value={String(settings.expenseAdjustmentPct)} onChangeText={(raw) => numeric(state.setValue, 'expenseAdjustmentPct', raw)} keyboardType="numbers-and-punctuation" /><FormField label="Inflasi tahunan (%)" value={String(settings.annualInflationPct)} onChangeText={(raw) => numeric(state.setValue, 'annualInflationPct', raw)} keyboardType="number-pad" /><FormField label="Imbal hasil tahunan (%)" value={String(settings.annualInvestmentReturnPct)} onChangeText={(raw) => numeric(state.setValue, 'annualInvestmentReturnPct', raw)} keyboardType="number-pad" /><MoneyInput label="Investasi bulanan" value={String(settings.monthlyInvestment)} onChangeValue={(raw) => numeric(state.setValue, 'monthlyInvestment', String(parseMoney(raw)))} /><AppButton fullWidth loading={state.isMutating} disabled={!state.isOnline} onPress={() => void state.save()}>Simpan skenario</AppButton></Card><Card><AppText variant="caption" muted>Proyeksi adalah simulasi berdasarkan asumsi, bukan nasihat finansial atau jaminan hasil.</AppText></Card></View>;
}

type ForecastSettings = { horizonDays: number; monthlyIncomeOverride: number; incomeDay: number; minimumCashBuffer: number };
const FORECAST_DEFAULT: ForecastSettings = { horizonDays: 60, monthlyIncomeOverride: 0, incomeDay: 25, minimumCashBuffer: 2_000_000 };
export function ForecastModule() {
  const { snapshot } = useApp();
  const state = useSettings('getCashflowForecastSettings', 'updateCashflowForecastSettings', FORECAST_DEFAULT as unknown as Record<string, unknown>);
  const settings = state.value as unknown as ForecastSettings;
  const starting = snapshot?.accounts.filter((item) => !item.liability && item.type !== 'Investment').reduce((sum, item) => sum + item.balance, 0) ?? 0;
  const monthlyIncome = settings.monthlyIncomeOverride || snapshot?.summary.income || 0;
  const monthlyExpense = snapshot?.summary.expense ?? 0;
  const series = useMemo(() => {
    let main = starting; let cautious = starting;
    const mainValues = [main]; const cautiousValues = [cautious];
    for (let day = 1; day <= settings.horizonDays; day += 1) {
      if ((day - 1) % 30 + 1 === settings.incomeDay) { main += monthlyIncome; cautious += monthlyIncome * 0.8; }
      main -= monthlyExpense / 30; cautious -= monthlyExpense / 30;
      snapshot?.bills.filter((bill) => Number(bill.dueDate.slice(8, 10)) === ((day - 1) % 30 + 1) && !bill.completed).forEach((bill) => { main -= bill.amount; cautious -= bill.amount; });
      mainValues.push(main); cautiousValues.push(cautious);
    }
    return { mainValues, cautiousValues };
  }, [monthlyExpense, monthlyIncome, settings.horizonDays, settings.incomeDay, snapshot?.bills, starting]);
  const firstRisk = series.mainValues.findIndex((value) => value < settings.minimumCashBuffer);
  if (state.loading) return <LoadingState />;
  return <View style={{ gap: spacing.md }}>{state.error ? <ErrorState message={state.error} onRetry={() => void state.load()} /> : null}<Card style={{ gap: spacing.sm }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><AppText variant="title">Forecast {settings.horizonDays} hari</AppText><StatusPill label={firstRisk < 0 ? 'Aman' : series.mainValues[firstRisk] < 0 ? 'Kritis' : 'Warning'} tone={firstRisk < 0 ? 'positive' : series.mainValues[firstRisk] < 0 ? 'negative' : 'warning'} /></View><ProjectionLineChart series={[{ label: 'Utama', values: series.mainValues, color: '#126b59' }, { label: 'Cautious', values: series.cautiousValues, color: '#d89832' }]} /><AppText muted>{firstRisk < 0 ? 'Saldo diproyeksikan tetap di atas buffer.' : `Saldo pertama kali di bawah buffer sekitar hari ke-${firstRisk}.`}</AppText></Card><Card style={{ gap: spacing.md }}><SelectField label="Horizon" value={String(settings.horizonDays)} onChange={(raw) => numeric(state.setValue, 'horizonDays', raw)} options={[30, 60, 90].map((value) => ({ label: `${value} hari`, value: String(value) }))} /><MoneyInput label="Pemasukan bulanan manual" value={String(settings.monthlyIncomeOverride)} onChangeValue={(raw) => numeric(state.setValue, 'monthlyIncomeOverride', String(parseMoney(raw)))} hint="Kosong/0 memakai pemasukan bulan berjalan." /><FormField label="Tanggal pemasukan (1–28)" value={String(settings.incomeDay)} onChangeText={(raw) => numeric(state.setValue, 'incomeDay', raw)} keyboardType="number-pad" /><MoneyInput label="Buffer kas minimum" value={String(settings.minimumCashBuffer)} onChangeValue={(raw) => numeric(state.setValue, 'minimumCashBuffer', String(parseMoney(raw)))} /><AppButton fullWidth loading={state.isMutating} onPress={() => void state.save()}>Simpan forecast</AppButton></Card></View>;
}

type EmergencySettings = { targetMonths: number; monthlyExpenseOverride: number; monthlyContribution: number; accountIds: string[] };
const EMERGENCY_DEFAULT: EmergencySettings = { targetMonths: 6, monthlyExpenseOverride: 0, monthlyContribution: 0, accountIds: [] };
export function EmergencyModule() {
  const { snapshot } = useApp();
  const state = useSettings('getEmergencyFundSettings', 'updateEmergencyFundSettings', EMERGENCY_DEFAULT as unknown as Record<string, unknown>);
  const settings = state.value as unknown as EmergencySettings;
  const eligible = snapshot?.accounts.filter((item) => !item.liability && item.type !== 'Investment') ?? [];
  const current = eligible.filter((item) => settings.accountIds.includes(item.id)).reduce((sum, item) => sum + item.balance, 0);
  const expense = settings.monthlyExpenseOverride || snapshot?.summary.expense || 0;
  const target = expense * settings.targetMonths; const gap = Math.max(0, target - current); const months = settings.monthlyContribution > 0 ? Math.ceil(gap / settings.monthlyContribution) : null; const coverage = expense > 0 ? current / expense : 0;
  if (state.loading) return <LoadingState />;
  return <View style={{ gap: spacing.md }}>{state.error ? <ErrorState message={state.error} onRetry={() => void state.load()} /> : null}<Card style={{ gap: spacing.sm }}><AppText variant="caption" muted>Coverage dana darurat</AppText><AppText variant="amount">{coverage.toFixed(1)} bulan</AppText><ProgressBar value={target ? current / target * 100 : 0} label="Kemajuan dana darurat" /><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><AppText muted>Gap</AppText><Amount value={gap} variant="label" /></View><AppText variant="caption" muted>{months === null ? 'Isi kontribusi bulanan untuk melihat estimasi.' : `Estimasi tercapai dalam ${months} bulan.`}</AppText></Card><Card style={{ gap: spacing.md }}><SelectField label="Target coverage" value={String(settings.targetMonths)} onChange={(raw) => numeric(state.setValue, 'targetMonths', raw)} options={[3, 6, 9, 12].map((value) => ({ label: `${value} bulan`, value: String(value) }))} /><MoneyInput label="Pengeluaran bulanan manual" value={String(settings.monthlyExpenseOverride)} onChangeValue={(raw) => numeric(state.setValue, 'monthlyExpenseOverride', String(parseMoney(raw)))} /><MoneyInput label="Kontribusi bulanan" value={String(settings.monthlyContribution)} onChangeValue={(raw) => numeric(state.setValue, 'monthlyContribution', String(parseMoney(raw)))} /><AppText variant="label">Akun likuid</AppText>{eligible.map((account) => { const selected = settings.accountIds.includes(account.id); return <AppButton key={account.id} tone={selected ? 'primary' : 'secondary'} fullWidth onPress={() => state.setValue((currentValue) => { const typed = currentValue as unknown as EmergencySettings; return { ...typed, accountIds: selected ? typed.accountIds.filter((id) => id !== account.id) : [...typed.accountIds, account.id] } as unknown as Record<string, unknown>; })}>{selected ? '✓ ' : ''}{account.name} · {formatCurrency(account.balance)}</AppButton>; })}<AppButton fullWidth loading={state.isMutating} onPress={() => void state.save()}>Simpan dana darurat</AppButton></Card></View>;
}

type Debt = { accountId: string; name: string; balance: number; annualInterestRatePct: number; minimumPayment: number; dueDay: number };
type DebtData = { settings: { strategy: 'avalanche' | 'snowball'; extraMonthlyPayment: number }; debts: Debt[] };
const DEBT_DEFAULT: DebtData = { settings: { strategy: 'avalanche', extraMonthlyPayment: 0 }, debts: [] };
export function DebtsModule() {
  const { snapshot, read, mutate, isMutating, isOnline } = useApp();
  const [data, setData] = useState<DebtData>(DEBT_DEFAULT); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [accountId, setAccountId] = useState(''); const [rate, setRate] = useState(''); const [minimum, setMinimum] = useState(''); const [dueDay, setDueDay] = useState('1');
  const load = useCallback(async () => { if (!isOnline) { setLoading(false); return; } try { setData(await read<DebtData>('getDebtPlanner')); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Rencana utang gagal dimuat.'); } finally { setLoading(false); } }, [isOnline, read]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  const projection = useMemo(() => data.debts.map((debt) => {
    const payment = debt.minimumPayment + data.settings.extraMonthlyPayment / Math.max(1, data.debts.length); const monthlyRate = debt.annualInterestRatePct / 100 / 12;
    if (payment <= debt.balance * monthlyRate) return { ...debt, months: null, interest: Infinity };
    let balance = debt.balance; let interest = 0; let months = 0;
    while (balance > 0 && months < 1200) { const monthlyInterest = balance * monthlyRate; interest += monthlyInterest; balance = Math.max(0, balance + monthlyInterest - payment); months += 1; }
    return { ...debt, months, interest };
  }), [data]);
  if (loading) return <LoadingState />;
  return <View style={{ gap: spacing.md }}>{error ? <ErrorState message={error} onRetry={() => void load()} /> : null}<Card style={{ gap: spacing.md }}><SelectField label="Strategi" value={data.settings.strategy} onChange={(strategy) => setData((value) => ({ ...value, settings: { ...value.settings, strategy: strategy as 'avalanche' | 'snowball' } }))} options={[{ label: 'Avalanche · bunga tertinggi', value: 'avalanche' }, { label: 'Snowball · saldo terkecil', value: 'snowball' }]} /><MoneyInput label="Pembayaran ekstra bulanan" value={String(data.settings.extraMonthlyPayment)} onChangeValue={(raw) => setData((value) => ({ ...value, settings: { ...value.settings, extraMonthlyPayment: parseMoney(raw) } }))} /><AppButton fullWidth loading={isMutating} onPress={() => void mutate('updateDebtPlanner', { mode: 'settings', ...data.settings }).then(load)}>Simpan strategi</AppButton></Card>{projection.map((debt) => <Card key={debt.accountId} style={{ gap: spacing.xs }}><AppText variant="title">{debt.name}</AppText><Amount value={debt.balance} variant="title" /><AppText muted>Bunga {formatPercent(debt.annualInterestRatePct)} · minimum {formatCurrency(debt.minimumPayment)}</AppText>{debt.months === null ? <StatusPill label="Non-amortizing" tone="negative" /> : <><StatusPill label={`${debt.months} bulan hingga lunas`} tone="info" /><AppText variant="caption" muted>Estimasi total bunga {formatCurrency(debt.interest)}</AppText></>}</Card>)}<Card style={{ gap: spacing.md }}><AppText variant="title">Tambahkan akun utang</AppText><SelectField label="Akun kewajiban" value={accountId} onChange={setAccountId} options={snapshot?.accounts.filter((item) => item.liability).map((item) => ({ label: item.name, value: item.id })) ?? []} /><FormField label="Bunga tahunan (%)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" /><MoneyInput label="Minimum payment" value={minimum} onChangeValue={setMinimum} /><FormField label="Tanggal jatuh tempo" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" /><AppButton fullWidth loading={isMutating} onPress={() => void mutate('updateDebtPlanner', { mode: 'debt', accountId, annualInterestRatePct: Number(rate), minimumPayment: parseMoney(minimum), dueDay: Number(dueDay) }).then(load)}>Simpan akun utang</AppButton></Card></View>;
}
