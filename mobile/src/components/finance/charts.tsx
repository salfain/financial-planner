import { useState } from 'react';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';
import { View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { usePreferences } from '@/providers/preferences-provider';
import { formatCompactCurrency } from '@/utils/format';
import { AppText } from '@/components/ui/app-text';

export function CashflowBarChart({ data }: { data: Array<{ label: string; income: number; expense: number }> }) {
  const { colors, privacyMode } = usePreferences();
  const max = Math.max(1, ...data.flatMap((item) => [item.income, item.expense]));
  return (
    <View accessibilityLabel={`Grafik arus kas ${data.length} hari`} style={{ gap: spacing.xs }}>
      <View style={{ height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
        {data.map((item, index) => (
          <View key={`${item.label}-${index}`} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
            <View style={{ flex: 1, minHeight: 2, height: `${Math.max(2, item.income / max * 100)}%`, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.positive }} />
            <View style={{ flex: 1, minHeight: 2, height: `${Math.max(2, item.expense / max * 100)}%`, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.negative }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}><AppText variant="caption" style={{ color: colors.positive }}>● Pemasukan</AppText><AppText variant="caption" style={{ color: colors.negative }}>● Pengeluaran</AppText><AppText variant="caption" muted style={{ flex: 1, textAlign: 'right' }}>Puncak {formatCompactCurrency(max, privacyMode)}</AppText></View>
    </View>
  );
}

export function DonutChart({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  const { colors, privacyMode } = usePreferences();
  const total = Math.max(1, items.reduce((sum, item) => sum + item.value, 0));
  const circumference = 2 * Math.PI * 38;
  const segments = items.map((item, index) => ({
    item,
    length: item.value / total * circumference,
    offset: items.slice(0, index).reduce((sum, previous) => sum + previous.value / total * circumference, 0),
  }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }} accessibilityLabel={`Komposisi pengeluaran, total ${formatCompactCurrency(total, privacyMode)}`}>
      <Svg width={106} height={106} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="38" stroke={colors.surfaceAlt} strokeWidth="14" fill="none" />
        {segments.map(({ item, length, offset }) => <Circle key={item.label} cx="50" cy="50" r="38" stroke={item.color} strokeWidth="14" fill="none" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} strokeLinecap="butt" transform="rotate(-90 50 50)" />)}
      </Svg>
      <View style={{ flex: 1, gap: 6 }}>
        {items.slice(0, 5).map((item) => <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} /><AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>{item.label}</AppText><AppText variant="caption" muted>{Math.round(item.value / total * 100)}%</AppText></View>)}
      </View>
    </View>
  );
}

export function ProjectionLineChart({ series }: { series: Array<{ label: string; values: number[]; color: string }> }) {
  const { colors } = usePreferences();
  const values = series.flatMap((item) => item.values);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = Math.max(1, max - min);
  const width = 300;
  const height = 150;
  const points = (data: number[]) => data.map((value, index) => {
    const x = data.length <= 1 ? 0 : index / (data.length - 1) * width;
    const y = height - ((value - min) / range * height);
    return `${x},${y}`;
  }).join(' ');
  const zeroY = height - ((0 - min) / range * height);
  return (
    <View style={{ gap: spacing.xs }} accessibilityLabel={`Grafik proyeksi ${series.map((item) => item.label).join(', ')}`}>
      <View style={{ overflow: 'hidden', borderRadius: radius.sm }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <Line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke={colors.border} strokeWidth="1" />
          {series.map((item) => <Polyline key={item.label} points={points(item.values)} fill="none" stroke={item.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />)}
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{series.map((item) => <AppText key={item.label} variant="caption" style={{ color: item.color }}>● {item.label}</AppText>)}</View>
    </View>
  );
}

type WealthHistoryPoint = { period: string; label: string; value: number };

export function WealthHistoryChart({ data }: { data: WealthHistoryPoint[] }) {
  const { colors, privacyMode } = usePreferences();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const width = Math.max(1, layoutWidth);
  const height = 148;
  const insetX = 8;
  const top = 18;
  const bottom = 124;
  const values = data.map((item) => item.value);
  const min = data.length ? Math.min(...values) : 0;
  const max = data.length ? Math.max(...values) : 1;
  const flat = data.length > 0 && data.every((item) => item.value === data[0].value);
  const range = Math.max(1, max - min);
  const points = data.map((item, index) => ({
    ...item,
    x: data.length <= 1 ? width / 2 : insetX + index / (data.length - 1) * (width - insetX * 2),
    y: flat ? (top + bottom) / 2 : bottom - (item.value - min) / range * (bottom - top),
  }));
  const polyline = points.map((item) => `${item.x},${item.y}`).join(' ');
  const area = points.length ? `${insetX},${bottom + 2} ${polyline} ${width - insetX},${bottom + 2}` : '';
  const compact = layoutWidth > 0 && layoutWidth < 390;
  const labels = compact && data.length >= 3
    ? [data[0], data[Math.floor((data.length - 1) / 2)], data[data.length - 1]]
    : data;

  return (
    <View accessibilityLabel="Grafik riwayat kekayaan bersih tujuh bulan" style={{ gap: spacing.xs }}>
      <View
        onLayout={(event) => setLayoutWidth(Math.round(event.nativeEvent.layout.width))}
        style={{ width: '100%', height, overflow: 'hidden', borderRadius: radius.sm }}
      >
        {layoutWidth > 0 ? (
          <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {[top, (top + bottom) / 2, bottom].map((y) => <Line key={y} x1={insetX} y1={y} x2={width - insetX} y2={y} stroke={colors.border} strokeWidth="1" />)}
            {area ? <Polygon points={area} fill={colors.primarySoft} opacity={0.62} /> : null}
            <Polyline points={polyline} fill="none" stroke={colors.primary} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((item) => <Circle key={item.period} cx={item.x} cy={item.y} r="4.5" fill={colors.surface} stroke={colors.primary} strokeWidth="3" />)}
          </Svg>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs }}>
        {labels.map((item, index) => (
          <View key={item.period} style={{ flex: 1, minWidth: 0, alignItems: index === 0 ? 'flex-start' : index === labels.length - 1 ? 'flex-end' : 'center' }}>
            <AppText variant="caption" muted>{item.label}</AppText>
            <AppText variant="caption" numberOfLines={1} style={{ fontSize: compact ? 10 : 11 }}>{formatCompactCurrency(item.value, privacyMode)}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
