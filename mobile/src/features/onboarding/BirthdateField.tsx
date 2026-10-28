import { useState } from 'react';

import { TextField, type FieldStatus } from '@/design';
import { parseDateOnly, toDateOnly } from '@/lib/validation';

export type BirthdateFieldProps = {
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** Feedback under the field, e.g. the 18+ message. */
  status?: FieldStatus | null;
};

/** Web and Android fallback: a plain "YYYY-MM-DD" text field. iOS uses the native date picker. */
export function BirthdateField({ value, onChange, status }: BirthdateFieldProps) {
  const [text, setText] = useState(value ? toDateOnly(value) : '');
  return (
    <TextField
      label="Birthday"
      value={text}
      placeholder="YYYY-MM-DD"
      keyboardType="numbers-and-punctuation"
      maxLength={10}
      onChangeText={(t) => {
        setText(t);
        onChange(parseDateOnly(t));
      }}
      status={status ?? { tone: 'neutral', text: 'Only used to check you are 18 or older. Never shown to anyone.' }}
    />
  );
}
