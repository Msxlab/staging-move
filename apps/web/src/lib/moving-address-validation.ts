const US_STATE_RE = /^[A-Z]{2}$/;

export interface MovingAddressStateInput {
  state?: string | null;
}

export type MovingAddressStateValidation =
  | { ok: true; fromState: string; toState: string }
  | { ok: false; field: "fromAddressId" | "toAddressId" | "destinationAddress.state"; error: string };

export function normalizeMovingState(value?: string | null): string {
  return (value || "").trim().toUpperCase();
}

function isValidState(value?: string | null): boolean {
  return US_STATE_RE.test(normalizeMovingState(value));
}

export function validateMovingAddressStates(input: {
  fromAddress: MovingAddressStateInput;
  toAddress: MovingAddressStateInput;
  destinationField: "toAddressId" | "destinationAddress.state";
}): MovingAddressStateValidation {
  const fromState = normalizeMovingState(input.fromAddress.state);
  const toState = normalizeMovingState(input.toAddress.state);

  if (!isValidState(fromState)) {
    return {
      ok: false,
      field: "fromAddressId",
      error: "Origin address must include a valid two-letter state.",
    };
  }

  if (!isValidState(toState)) {
    return {
      ok: false,
      field: input.destinationField,
      error: "Destination address must include a valid two-letter state.",
    };
  }

  return { ok: true, fromState, toState };
}
