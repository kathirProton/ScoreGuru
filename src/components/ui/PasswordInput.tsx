"use client";
import { useState } from "react";

/** Masked password field with a show/hide toggle. */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  required,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className="sg-input pr-14"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoFocus={autoFocus}
        maxLength={40}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-semibold text-ink-muted hover:text-ink"
        tabIndex={-1}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
