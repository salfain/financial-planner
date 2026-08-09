import DateTimePicker from '@react-native-community/datetimepicker';
import { Check, ChevronDown, CalendarDays } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Modal, Platform, Pressable, ScrollView, Switch, TextInput, type TextInputProps, View,
} from 'react-native';

import { fontFamily, radius, spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { usePreferences } from '@/providers/preferences-provider';
import { digitsOnly, formatMoneyInput } from '@/utils/format';
import { AppText } from './app-text';
import { IconButton } from './buttons';

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
};

export function FormField({ label, error, hint, required, style, secureTextEntry, ...props }: FieldProps) {
  const { colors } = usePreferences();
  const errorId = `${label.replace(/\s/g, '-').toLowerCase()}-error`;
  const hideSecureSelection = Platform.OS === 'android' && secureTextEntry;
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{label}{required ? ' *' : ''}</AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled: props.editable === false }}
        aria-errormessage={error ? errorId : undefined}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        selectionColor={hideSecureSelection ? 'transparent' : colors.primary}
        cursorColor={colors.primary}
        selectionHandleColor={hideSecureSelection ? 'transparent' : colors.primary}
        underlineColorAndroid="transparent"
        {...props}
        style={[
          {
            minHeight: 48,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? colors.negative : colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            paddingHorizontal: spacing.sm,
            paddingVertical: 11,
            fontFamily: fontFamily.regular,
            fontSize: 15,
          },
          style,
        ]}
      />
      {error ? <AppText nativeID={errorId} variant="caption" style={{ color: colors.negative }}>{error}</AppText> : hint ? <AppText variant="caption" muted>{hint}</AppText> : null}
    </View>
  );
}

type MoneyFieldProps = Omit<FieldProps, 'value' | 'onChangeText' | 'keyboardType'> & {
  value: string;
  onChangeValue: (digits: string) => void;
  currency?: string;
};

export function MoneyInput({ value, onChangeValue, currency = 'Rp', ...props }: MoneyFieldProps) {
  const { colors } = usePreferences();
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{props.label}{props.required ? ' *' : ''}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, borderRadius: radius.md, borderWidth: 1, borderColor: props.error ? colors.negative : colors.border, backgroundColor: colors.surface }}>
        <AppText variant="title" style={{ paddingLeft: spacing.sm, color: colors.primary }}>{currency}</AppText>
        <TextInput
          accessibilityLabel={props.label}
          value={formatMoneyInput(value)}
          onChangeText={(next) => onChangeValue(digitsOnly(next))}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          selectionHandleColor={colors.primary}
          underlineColorAndroid="transparent"
          style={{ flex: 1, minHeight: 52, paddingHorizontal: spacing.sm, color: colors.text, fontFamily: fontFamily.bold, fontSize: 22 }}
        />
      </View>
      {props.error ? <AppText variant="caption" style={{ color: colors.negative }}>{props.error}</AppText> : props.hint ? <AppText variant="caption" muted>{props.hint}</AppText> : null}
    </View>
  );
}

export type SelectOption = { label: string; value: string; description?: string; disabled?: boolean };

export function SelectField({ label, value, options, onChange, error, placeholder = 'Pilih' }: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const { colors } = usePreferences();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.value === value);
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${selected?.label ?? placeholder}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md,
          borderWidth: 1, borderColor: error ? colors.negative : colors.border,
          backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
        })}
      >
        <AppText style={{ flex: 1 }} muted={!selected}>{selected?.label ?? placeholder}</AppText>
        <ChevronDown size={18} color={colors.textMuted} />
      </Pressable>
      {error ? <AppText variant="caption" style={{ color: colors.negative }}>{error}</AppText> : null}
      <Modal visible={open} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.md, paddingBottom: 36, maxHeight: '72%', gap: spacing.xs }}>
            <AppText variant="title" style={{ marginBottom: spacing.xs }}>{label}</AppText>
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.xs }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={options.length > 6}
            >
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: value === option.value, disabled: option.disabled }}
                  disabled={option.disabled}
                  onPress={() => { onChange(option.value); setOpen(false); }}
                  style={({ pressed }) => ({
                    minHeight: 52, padding: spacing.sm, borderRadius: radius.md,
                    backgroundColor: value === option.value ? colors.primarySoft : pressed ? colors.surfaceAlt : 'transparent',
                    opacity: option.disabled ? 0.45 : 1,
                    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="label">{option.label}</AppText>
                    {option.description ? <AppText variant="caption" muted>{option.description}</AppText> : null}
                  </View>
                  {value === option.value ? <Check size={19} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function DateField({ label, value, onChange, maximumDate, minimumDate }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maximumDate?: Date;
  minimumDate?: Date;
}) {
  const { colors } = usePreferences();
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => new Date(`${value || '2000-01-01'}T12:00:00`), [value]);
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md,
          borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        })}
      >
        <AppText>{value}</AppText><CalendarDays size={18} color={colors.textMuted} />
      </Pressable>
      {open ? <DateTimePicker
        value={Number.isNaN(parsed.getTime()) ? new Date() : parsed}
        mode="date"
        display={Platform.OS === 'ios' ? 'inline' : 'default'}
        maximumDate={maximumDate}
        minimumDate={minimumDate}
        onChange={(_event, date) => {
          if (Platform.OS !== 'ios') setOpen(false);
          if (date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            onChange(`${year}-${month}-${day}`);
          }
        }}
      /> : null}
      {open && Platform.OS === 'ios' ? <IconButton icon={Check} label="Selesai memilih tanggal" onPress={() => setOpen(false)} /> : null}
    </View>
  );
}

export function SegmentedControl<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  const { colors } = usePreferences();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', padding: 3, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, gap: 3 }}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: option.value === value }}
          onPress={() => onChange(option.value)}
          style={({ pressed }) => ({
            flex: 1, minHeight: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 6, backgroundColor: option.value === value ? colors.surface : pressed ? colors.border : 'transparent',
          })}
        >
          <AppText variant="label" style={{ color: option.value === value ? colors.primary : colors.textMuted, textAlign: 'center' }}>{option.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

export function SwitchField({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = usePreferences();
  return (
    <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}><AppText variant="label">{label}</AppText>{description ? <AppText variant="caption" muted>{description}</AppText> : null}</View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
    </View>
  );
}
