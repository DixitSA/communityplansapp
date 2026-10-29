import { useState } from 'react';

import { TextField, type FieldStatus } from '@/design';
import { parseDateTime } from '@/lib/submission';

export type DateTimeFieldProps = {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  status?: FieldStatus | null;
};

/** Web and Android fallback: a plain "YYYY-MM-DD HH:mm" text field. iOS uses the native picker. */
export function DateTimeField({ label, value, onChange, status }: DateTimeFieldProps) {
  const [text, setText] = useState('');
  return (
    <TextField
      label={label}
      value={text}
      placeholder="YYYY-MM-DD HH:mm"
      keyboardType="numbers-and-punctuation"
      maxLength={16}
      onChangeText={(t) => {
        setText(t);
        onChange(parseDateTime(t));
      }}
      status={status ?? (value ? null : { tone: 'neutral', text: 'Use 24-hour time, like 2026-11-07 19:30.' })}
    />
  );
}
