import { z } from "zod";

function requiredText(label) {
  return z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`);
}

function requiredEmail(label) {
  return z
    .string({ required_error: `${label} is required` })
    .trim()
    .email(`Invalid ${label.toLowerCase()} format`)
    .toLowerCase();
}

export const supportProviderSchema = z.object({
  companyName: requiredText("Company name"),
  supportPhone: requiredText("Support phone"),
  supportEmail: requiredEmail("Support email"),
  contactName: requiredText("Contact name"),
  contactPhone: requiredText("Contact phone"),
  contactEmail: requiredEmail("Contact email"),
});
