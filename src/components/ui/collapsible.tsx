"use client";

// Collapsible is a thin Radix primitive re-export.
// Styling is applied at the call site via className on the trigger/content.
// No design-system overrides needed here — the components render no
// visual chrome of their own.

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

const Collapsible        = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
