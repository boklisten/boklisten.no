import db from "@adonisjs/lucid/services/db";
import { ObjectId } from "mongodb";

import BadRequestException from "#exceptions/bad_request_exception";
import BranchSubject from "#models/branch_subject";
import { StorageService } from "#services/storage_service";

export interface BranchSubjectBookInput {
  itemId: string;
  rent: boolean;
  partlyPayment: boolean;
  buy: boolean;
  rentAtBranch: boolean;
  partlyPaymentAtBranch: boolean;
  buyAtBranch: boolean;
}

export interface BranchSubjectInput {
  name: string;
  externalName: string;
  books: BranchSubjectBookInput[];
}

/**
 * The matching key for subject names: uploads compare CSV subject names against externalName with
 * this normalization, so uniqueness within a branch must be enforced with the same rule.
 */
export function normalizeSubjectName(value: string) {
  return value.replaceAll(/\s/g, "").toLowerCase();
}

async function fetchItemTitles(itemIds: string[]): Promise<Map<string, string>> {
  if (itemIds.length === 0) {
    return new Map();
  }
  const items = await StorageService.Items.aggregate<{ id: string; title: string }>([
    { $match: { _id: { $in: itemIds.map((id) => new ObjectId(id)) } } },
    { $project: { title: 1 } },
  ]);
  return new Map(items.map((item) => [item.id, item.title]));
}

export interface SubjectForUpload {
  externalName: string;
  books: { itemId: string; title: string }[];
}

/**
 * The subject-choices upload's view of a branch subtree: every subject grouped by branch, books
 * flattened to (itemId, title). A subject with no books is included on purpose — matching it means
 * the CSV subject is recognized but produces no order lines.
 */
export async function fetchSubjectsForUpload(
  branchIds: string[],
): Promise<Map<string, SubjectForUpload[]>> {
  if (branchIds.length === 0) {
    return new Map();
  }
  const subjects = await BranchSubject.query().whereIn("branchId", branchIds).preload("books");
  const itemIds = [...new Set(subjects.flatMap((subject) => subject.books.map((b) => b.itemId)))];
  const titleByItemId = await fetchItemTitles(itemIds);
  const subjectsByBranchId = new Map<string, SubjectForUpload[]>();
  for (const subject of subjects) {
    const branchSubjects = subjectsByBranchId.get(subject.branchId) ?? [];
    branchSubjects.push({
      externalName: subject.externalName,
      books: subject.books.map((book) => ({
        itemId: book.itemId,
        title: titleByItemId.get(book.itemId) ?? "",
      })),
    });
    subjectsByBranchId.set(subject.branchId, branchSubjects);
  }
  return subjectsByBranchId;
}

async function toResponse(subjects: BranchSubject[]) {
  const itemIds = [...new Set(subjects.flatMap((subject) => subject.books.map((b) => b.itemId)))];
  const titleByItemId = await fetchItemTitles(itemIds);
  return subjects
    .map((subject) => ({
      id: subject.id,
      name: subject.name,
      externalName: subject.externalName,
      books: subject.books
        .map((book) => ({
          item: { id: book.itemId, title: titleByItemId.get(book.itemId) ?? "" },
          rent: book.rent,
          partlyPayment: book.partlyPayment,
          buy: book.buy,
          rentAtBranch: book.rentAtBranch,
          partlyPaymentAtBranch: book.partlyPaymentAtBranch,
          buyAtBranch: book.buyAtBranch,
        }))
        .toSorted((a, b) => a.item.title.localeCompare(b.item.title)),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

function assertValidInput(input: BranchSubjectInput, existingSubjects: BranchSubject[]) {
  const normalizedName = normalizeSubjectName(input.name);
  const normalizedExternalName = normalizeSubjectName(input.externalName);
  if (normalizedName.length === 0) {
    throw new BadRequestException("Faget må ha et navn");
  }
  if (normalizedExternalName.length === 0) {
    throw new BadRequestException("Faget må ha et eksternt navn");
  }
  if (existingSubjects.some((subject) => normalizeSubjectName(subject.name) === normalizedName)) {
    throw new BadRequestException(`Det finnes allerede et fag med navnet "${input.name}"`);
  }
  if (
    existingSubjects.some(
      (subject) => normalizeSubjectName(subject.externalName) === normalizedExternalName,
    )
  ) {
    throw new BadRequestException(
      `Det finnes allerede et fag med det eksterne navnet "${input.externalName}"`,
    );
  }
  const itemIds = input.books.map((book) => book.itemId);
  if (new Set(itemIds).size !== itemIds.length) {
    throw new BadRequestException("Samme bok kan ikke legges til flere ganger i ett fag");
  }
}

function toBookRows(books: BranchSubjectBookInput[]) {
  return books.map((book) => ({
    itemId: book.itemId,
    rent: book.rent,
    partlyPayment: book.partlyPayment,
    buy: book.buy,
    rentAtBranch: book.rentAtBranch,
    partlyPaymentAtBranch: book.partlyPaymentAtBranch,
    buyAtBranch: book.buyAtBranch,
  }));
}

async function findSubjectOrFail(branchId: string, subjectId: number) {
  const subject = await BranchSubject.query()
    .where("id", subjectId)
    .where("branchId", branchId)
    .first();
  if (!subject) {
    throw new BadRequestException("Fant ikke faget");
  }
  return subject;
}

export const BranchSubjectsService = {
  async list(branchId: string) {
    const subjects = await BranchSubject.query().where("branchId", branchId).preload("books");
    return toResponse(subjects);
  },

  async create(branchId: string, input: BranchSubjectInput) {
    const existingSubjects = await BranchSubject.query().where("branchId", branchId);
    assertValidInput(input, existingSubjects);
    await db.transaction(async (trx) => {
      const subject = await BranchSubject.create(
        { branchId, name: input.name.trim(), externalName: input.externalName.trim() },
        { client: trx },
      );
      await subject.related("books").createMany(toBookRows(input.books));
    });
  },

  async update(branchId: string, subjectId: number, input: BranchSubjectInput) {
    const existingSubjects = await BranchSubject.query().where("branchId", branchId);
    const subject = existingSubjects.find((existing) => existing.id === subjectId);
    if (!subject) {
      throw new BadRequestException("Fant ikke faget");
    }
    assertValidInput(
      input,
      existingSubjects.filter((existing) => existing.id !== subjectId),
    );
    await db.transaction(async (trx) => {
      subject.useTransaction(trx);
      subject.merge({ name: input.name.trim(), externalName: input.externalName.trim() });
      await subject.save();
      await subject.related("books").query().delete();
      await subject.related("books").createMany(toBookRows(input.books));
    });
  },

  async destroy(branchId: string, subjectId: number) {
    const subject = await findSubjectOrFail(branchId, subjectId);
    await subject.delete();
  },

  /**
   * Seeds subjects from the branch's legacy branchItem categories: one subject per category, with
   * the tagged books and their options copied over. Categories whose name or external name already
   * exists as a subject (normalized) are skipped, so the import is re-runnable and never
   * overwrites manual edits.
   */
  async importFromBranchItems(branchId: string) {
    const branchItems = await StorageService.BranchItems.aggregate<
      { itemId: string; categories: string[] } & Record<
        "rent" | "partlyPayment" | "buy" | "rentAtBranch" | "partlyPaymentAtBranch" | "buyAtBranch",
        boolean
      >
    >([
      { $match: { branch: new ObjectId(branchId) } },
      {
        $project: {
          itemId: { $toString: "$item" },
          categories: { $ifNull: ["$categories", []] },
          rent: { $ifNull: ["$rent", false] },
          partlyPayment: { $ifNull: ["$partlyPayment", false] },
          buy: { $ifNull: ["$buy", false] },
          rentAtBranch: { $ifNull: ["$rentAtBranch", false] },
          partlyPaymentAtBranch: { $ifNull: ["$partlyPaymentAtBranch", false] },
          buyAtBranch: { $ifNull: ["$buyAtBranch", false] },
        },
      },
    ]);

    const booksByCategory = new Map<string, { name: string; books: BranchSubjectBookInput[] }>();
    for (const branchItem of branchItems) {
      for (const category of branchItem.categories) {
        const name = category.trim();
        if (name.length === 0) {
          continue;
        }
        const key = normalizeSubjectName(name);
        const entry = booksByCategory.get(key) ?? { name, books: [] };
        if (!entry.books.some((book) => book.itemId === branchItem.itemId)) {
          entry.books.push({
            itemId: branchItem.itemId,
            rent: branchItem.rent,
            partlyPayment: branchItem.partlyPayment,
            buy: branchItem.buy,
            rentAtBranch: branchItem.rentAtBranch,
            partlyPaymentAtBranch: branchItem.partlyPaymentAtBranch,
            buyAtBranch: branchItem.buyAtBranch,
          });
        }
        booksByCategory.set(key, entry);
      }
    }

    const existingSubjects = await BranchSubject.query().where("branchId", branchId);
    const existingKeys = new Set(
      existingSubjects.flatMap((subject) => [
        normalizeSubjectName(subject.name),
        normalizeSubjectName(subject.externalName),
      ]),
    );

    let createdSubjects = 0;
    let skippedExisting = 0;
    await db.transaction(async (trx) => {
      for (const [key, { name, books }] of booksByCategory) {
        if (existingKeys.has(key)) {
          skippedExisting++;
          continue;
        }
        const subject = await BranchSubject.create(
          { branchId, name, externalName: name },
          { client: trx },
        );
        await subject.related("books").createMany(toBookRows(books));
        createdSubjects++;
      }
    });
    return { createdSubjects, skippedExisting };
  },
};
