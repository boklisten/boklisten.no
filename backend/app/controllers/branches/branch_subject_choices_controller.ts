import type { HttpContext } from "@adonisjs/core/http";

import BadRequestException from "#exceptions/bad_request_exception";
import {
  findInvalidDeadlines,
  findPastDeadlines,
  SubjectChoicesService,
} from "#services/subject_choices_service";
import { subjectChoicesValidator } from "#validators/subject_choices";

function assertValidDeadlines(rows: { deadline: string }[]) {
  const invalidDeadlines = findInvalidDeadlines(rows);
  if (invalidDeadlines.length > 0) {
    throw new BadRequestException(`Ugyldig frist: ${invalidDeadlines.join(", ")}`);
  }
  const pastDeadlines = findPastDeadlines(rows, new Date());
  if (pastDeadlines.length > 0) {
    throw new BadRequestException(`Fristen må være i fremtiden: ${pastDeadlines.join(", ")}`);
  }
}

export default class BranchSubjectChoicesController {
  async evaluate(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    const { rows } = await ctx.request.validateUsing(subjectChoicesValidator);
    assertValidDeadlines(rows);
    return SubjectChoicesService.evaluate(branchId, rows);
  }

  async upload(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    const { rows } = await ctx.request.validateUsing(subjectChoicesValidator);
    assertValidDeadlines(rows);
    return SubjectChoicesService.upload(branchId, rows);
  }
}
