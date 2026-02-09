import { z } from "zod";
const TallyDataFields = z.array(
  z.object({
    key: z.string(),
    label: z.string().nullable().optional(),
    type: z.string(),
    value: z.any(),
    options: z.array(z.object({
      id: z.string(),
      text: z.string(),
    })).optional(),
  }),
);
const TallyData = z.object({
  responseId: z.string(),
  submissionId: z.string(),
  respondentId: z.string(),
  formId: z.string(),
  formName: z.string(),
  createdAt: z.string(),
  fields: TallyDataFields,
});
const TallySchema = z.object({
  eventId: z.string(),
  eventType: z.string().optional(),
  createdAt: z.string(),
  data: TallyData,
});
export type Tally = z.infer<typeof TallySchema>;
export { TallySchema };
