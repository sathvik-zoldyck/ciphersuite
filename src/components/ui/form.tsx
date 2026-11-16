"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import {
  Controller, FormProvider, useFormContext,
  type ControllerProps, type FieldPath, type FieldValues,
} from "react-hook-form";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

// ─── Exports ──────────────────────────────────────────────────────────────────

const Form = FormProvider;

// ─── Context ──────────────────────────────────────────────────────────────────

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = { name: TName };

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
);

type FormItemContextValue = { id: string };

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
);

// ─── FormField ────────────────────────────────────────────────────────────────

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) => (
  <FormFieldContext.Provider value={{ name: props.name }}>
    <Controller {...props} />
  </FormFieldContext.Provider>
);

// ─── useFormField ─────────────────────────────────────────────────────────────

const useFormField = () => {
  const fieldCtx = React.useContext(FormFieldContext);
  const itemCtx  = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();
  const fieldState = getFieldState(fieldCtx.name, formState);

  if (!fieldCtx) {
    throw new Error("useFormField must be used within <FormField>");
  }

  const { id } = itemCtx;
  return {
    id,
    name:               fieldCtx.name,
    formItemId:         `${id}-form-item`,
    formDescriptionId:  `${id}-form-item-description`,
    formMessageId:      `${id}-form-item-message`,
    ...fieldState,
  };
};

// ─── FormItem ─────────────────────────────────────────────────────────────────

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn("space-y-1.5", className)} {...props} />
    </FormItemContext.Provider>
  );
});
FormItem.displayName = "FormItem";

// ─── FormLabel ────────────────────────────────────────────────────────────────

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();
  return (
    <Label
      ref={ref}
      htmlFor={formItemId}
      className={cn(
        error && "text-red-400",
        className
      )}
      {...props}
    />
  );
});
FormLabel.displayName = "FormLabel";

// ─── FormControl ──────────────────────────────────────────────────────────────

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={
        !error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
});
FormControl.displayName = "FormControl";

// ─── FormDescription ──────────────────────────────────────────────────────────

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField();
  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-[11px] font-sans text-slate-600 leading-relaxed", className)}
      {...props}
    />
  );
});
FormDescription.displayName = "FormDescription";

// ─── FormMessage ──────────────────────────────────────────────────────────────

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? "") : children;

  if (!body) return null;

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn(
        "text-[11px] font-sans font-semibold text-red-400 flex items-center gap-1.5",
        className
      )}
      {...props}
    >
      {/* Inline error dot */}
      <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
      {body}
    </p>
  );
});
FormMessage.displayName = "FormMessage";

export {
  useFormField,
  Form, FormItem, FormLabel, FormControl,
  FormDescription, FormMessage, FormField,
};