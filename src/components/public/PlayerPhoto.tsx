"use client";
import { useState } from "react";
import Image from "next/image";
import { Avatar } from "@/components/ui/primitives";

/**
 * Player avatar that opens a full-size lightbox when it has a photo.
 * Falls back to a non-clickable initials avatar when there's no photo.
 */
export function PlayerPhoto({ name, photo, size = 76 }: { name: string; photo: string | null; size?: number }) {
  const [open, setOpen] = useState(false);
  if (!photo) return <Avatar name={name} photo={null} size={size} ring />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full transition active:scale-95"
        aria-label={`View ${name}'s photo`}
      >
        <Avatar name={name} photo={photo} size={size} ring />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div className="relative max-h-[85vh] w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Image
              src={photo}
              alt={name}
              width={800}
              height={800}
              className="mx-auto h-auto max-h-[85vh] w-auto rounded-2xl object-contain"
            />
            <p className="mt-3 text-center font-display font-bold text-ink">{name}</p>
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-cream-300 text-ink shadow-lift"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
