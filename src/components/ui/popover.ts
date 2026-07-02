// Tiny shared guard so a modal backdrop click that closes an open in-modal
// popover (e.g. a Select dropdown) doesn't ALSO tear down the whole modal.
// The popover closes on `mousedown`; the modal backdrop closes on `click`.
// When the popover records its close, the modal ignores the immediately
// following backdrop click.
let popoverClosedAt = 0;

export function notePopoverClose() {
  popoverClosedAt = Date.now();
}

export function popoverJustClosed() {
  return Date.now() - popoverClosedAt < 300;
}
