/**
 * Type-level inference utilities for Sveltia CMS collections.
 *
 * These types mirror the runtime behavior of {@link fieldToZod} in
 * `schema.ts`, allowing TypeScript to infer the output shape of a
 * collection's Zod schema from its field definitions — without
 * maintaining a separate type map.
 *
 * ## Usage
 *
 * For inference to work, collection definitions must preserve literal
 * types. The simplest way is a `const`-generic helper:
 *
 * ```ts
 * import type { EntryCollection } from "@sveltia/cms";
 *
 * function defineCollection<const C extends EntryCollection>(c: C): C {
 *   return c;
 * }
 *
 * const authors = defineCollection({
 *   name: "authors",
 *   folder: "content/authors",
 *   fields: [
 *     { name: "email", widget: "string", required: true },
 *     { name: "bio", widget: "text", required: false },
 *   ],
 * });
 *
 * type AuthorData = InferCollectionOutput<typeof authors>;
 * // => { email: string; bio?: string }
 * ```
 *
 * When field definitions are not narrowed (plain `Field[]`), the types
 * degrade gracefully to `string` / `unknown` — matching current behavior.
 *
 * @module
 */

import type { Field, VariableFieldType } from "@sveltia/cms";

// ─── Utility Types ───────────────────────────────────────────

/** Flatten intersection types for readability in hover tooltips. */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Determine if a field is optional at the type level.
 *
 * Mirrors the runtime {@link isOptionalField}: a field is optional only
 * when `required` is explicitly `false` or an empty locale array.
 * All other cases (absent, `true`, non-empty array) are required.
 */
type IsOptional<F extends Field> =
	F extends { required: false }
		? true
		: F extends { required: readonly [] }
			? true
			: false;

// ─── Field Output Inference ──────────────────────────────────

/**
 * Infer the TypeScript output type for a single Sveltia CMS field.
 *
 * Each branch mirrors a case in the runtime `fieldToZod()` switch so
 * that `z.infer<schema>` and `InferFieldOutput<F>` agree.
 */
export type InferFieldOutput<F extends Field> =
	// ── String-like widgets ─────────────────────────────────
	F extends {
		widget:
			| "string"
			| "text"
			| "color"
			| "map"
			| "uuid"
			| "compute"
			| "markdown"
			| "richtext";
	}
		? string
		: // ── Number ─────────────────────────────────────────────
			F extends { widget: "number"; value_type: "int/string" | "float/string" }
			? number | string
			: F extends { widget: "number" }
				? number
				: // ── Boolean ────────────────────────────────────────────
					F extends { widget: "boolean" }
					? boolean
					: // ── DateTime (z.coerce.date()) ─────────────────────────
						F extends { widget: "datetime" }
						? Date
						: // ── Image ──────────────────────────────────────────────
							F extends { widget: "image"; multiple: true }
							? string[]
							: F extends { widget: "image" }
								? string
								: // ── File ───────────────────────────────────────────────
									F extends { widget: "file"; multiple: true }
									? string[]
									: F extends { widget: "file" }
										? string
										: // ── Select (extracts literal option values when const) ──
											F extends {
													widget: "select";
													multiple: true;
													options: readonly (infer O)[];
												}
											? (O extends { value: infer V } ? V : O)[]
											: F extends {
														widget: "select";
														options: readonly (infer O)[];
													}
												? O extends { value: infer V }
													? V
													: O
												: // Select fallback (non-const options)
													F extends { widget: "select"; multiple: true }
													? (string | number | null)[]
													: F extends { widget: "select" }
														? string | number | null
														: // ── Relation ────────────────────────────────────────────
															F extends { widget: "relation"; multiple: true }
															? string[]
															: F extends { widget: "relation" }
																? string
																: // ── KeyValue ────────────────────────────────────────────
																	F extends { widget: "keyvalue" }
																	? Record<string, string>
																	: // ── Code ────────────────────────────────────────────────
																		F extends {
																				widget: "code";
																				output_code_only: true;
																			}
																		? string
																		: F extends { widget: "code" }
																			? { code: string; lang: string }
																			: // ── Hidden (infer from default value type) ──────────────
																				F extends { widget: "hidden"; default: string }
																				? string
																				: F extends { widget: "hidden"; default: number }
																					? number
																					: F extends { widget: "hidden"; default: boolean }
																						? boolean
																						: F extends { widget: "hidden" }
																							? unknown
																							: // ── Object with fields (recursive) ─────────────────────
																								F extends {
																										widget: "object";
																										fields: infer Sub extends readonly Field[];
																									}
																								? InferFieldsOutput<Sub>
																								: // ── Object with types (discriminated union) ─────────────
																									F extends {
																											widget: "object";
																											types: infer Types extends readonly VariableFieldType[];
																										}
																									? InferVariants<
																											Types,
																											F extends {
																												typeKey: infer K extends string;
																											}
																												? K
																												: "type"
																										>
																									: // ── List with types ─────────────────────────────────────
																										F extends {
																												widget: "list";
																												types: infer Types extends readonly VariableFieldType[];
																											}
																										? InferVariants<
																												Types,
																												F extends {
																													typeKey: infer K extends string;
																												}
																													? K
																													: "type"
																											>[]
																										: // ── List with fields ────────────────────────────────────
																											F extends {
																													widget: "list";
																													fields: infer Sub extends readonly Field[];
																												}
																											? InferFieldsOutput<Sub>[]
																											: // ── List with single field ──────────────────────────────
																												F extends {
																														widget: "list";
																														field: infer Sub extends Field;
																													}
																												? InferFieldOutput<Sub>[]
																												: // ── Simple list (default: string[]) ─────────────────────
																													F extends { widget: "list" }
																													? string[]
																													: // ── Default: string (StringField widget is optional) ─────
																														string;

// ─── Compound Type Inference ─────────────────────────────────

/**
 * Infer the output type for a discriminated union of variable field types.
 * Each variant gets a discriminator key (default `"type"`) set to its name.
 */
type InferVariants<
	Types extends readonly VariableFieldType[],
	TypeKey extends string,
> = Types[number] extends infer V
	? V extends VariableFieldType
		? Prettify<
				{ [K in TypeKey]: V["name"] } & (V extends {
					fields: infer Sub extends readonly Field[];
				}
					? InferFieldsOutput<Sub>
					: Record<string, never>)
			>
		: never
	: never;

/**
 * Infer the full output type for a collection's fields array.
 *
 * Separates required fields (always present) from optional fields
 * (may be `undefined`), matching runtime {@link isOptionalField}
 * semantics: fields are required by default unless explicitly
 * `required: false` or `required: []`.
 */
export type InferFieldsOutput<Fields extends readonly Field[]> = Prettify<
	{
		[F in Fields[number] as IsOptional<F> extends true
			? never
			: F["name"]]: InferFieldOutput<F>;
	} & {
		[F in Fields[number] as IsOptional<F> extends true
			? F["name"]
			: never]?: InferFieldOutput<F>;
	}
>;

// ─── Collection-Level Inference ──────────────────────────────

/**
 * Infer the full output type for an `EntryCollection`'s fields.
 *
 * @example
 * ```ts
 * const col = defineCollection({ name: "authors", folder: "...", fields: [...] });
 * type AuthorData = InferCollectionOutput<typeof col>;
 * ```
 */
export type InferCollectionOutput<C extends { fields: readonly Field[] }> =
	InferFieldsOutput<C["fields"]>;
