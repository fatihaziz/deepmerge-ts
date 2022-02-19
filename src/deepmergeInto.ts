import type {
  DeepMergeBuiltInMetaData,
  DeepMergeHKT,
  DeepMergeOptions,
} from "./types";
import {
  getIterableOfIterables,
  getKeys,
  getObjectType,
  ObjectType,
  objectHasProperty,
} from "./utils";

const defaultMergeIntoFunctions = {
  mergeMapsInto,
  mergeSetsInto,
  mergeArraysInto,
  mergeRecordsInto,
} as const;

/**
 * Deeply merge objects.
 *
 * @param objects - The objects to merge.
 */
export function deepmergeInto<T, Ts extends Readonly<ReadonlyArray<unknown>>>(
  target: T,
  ...objects: readonly [...Ts]
): DeepMergeHKT<
  Ts,
  DeepMergeIntoMergeFunctionsDefaultURIs,
  DeepMergeBuiltInMetaData
> {
  return deepmergeIntoCustom({})(target, ...objects) as DeepMergeHKT<
    Ts,
    DeepMergeIntoMergeFunctionsDefaultURIs,
    DeepMergeBuiltInMetaData
  >;
}

/**
 * Deeply merge two or more objects using the given options.
 *
 * @param options - The options on how to customize the merge function.
 */
export function deepmergeIntoCustom<
  PMF extends Partial<DeepMergeIntoMergeFunctionsURIs>
>(
  options: DeepMergeOptions<DeepMergeBuiltInMetaData, DeepMergeBuiltInMetaData>
): <T, Ts extends ReadonlyArray<unknown>>(
  target: T,
  ...objects: Ts
) => DeepMergeHKT<
  Ts,
  GetDeepMergeIntoMergeFunctionsURIs<PMF>,
  DeepMergeBuiltInMetaData
>;

/**
 * Deeply merge two or more objects using the given options and meta data.
 *
 * @param options - The options on how to customize the merge function.
 * @param rootMetaData - The meta data passed to the root items' being merged.
 */
export function deepmergeIntoCustom<
  PMF extends Partial<DeepMergeIntoMergeFunctionsURIs>,
  MetaData,
  MetaMetaData extends Readonly<
    Record<PropertyKey, unknown>
  > = DeepMergeBuiltInMetaData
>(
  options: DeepMergeOptions<MetaData, MetaMetaData>,
  rootMetaData?: MetaData
): <T, Ts extends ReadonlyArray<unknown>>(
  target: T,
  ...objects: Ts
) => DeepMergeHKT<Ts, GetDeepMergeIntoMergeFunctionsURIs<PMF>, MetaData>;

export function deepmergeIntoCustom<
  PMF extends Partial<DeepMergeIntoMergeFunctionsURIs>,
  MetaData,
  MetaMetaData extends Readonly<Record<PropertyKey, unknown>>
>(
  options: DeepMergeOptions<MetaData, MetaMetaData>,
  rootMetaData?: MetaData
): <T, Ts extends ReadonlyArray<unknown>>(
  target: T,
  ...objects: Ts
) => DeepMergeHKT<Ts, GetDeepMergeIntoMergeFunctionsURIs<PMF>, MetaData> {
  /**
   * The type of the customized deepmerge function.
   */
  type CustomizedDeepmergeInto = <T, Ts extends ReadonlyArray<unknown>>(
    target: T,
    ...objects: Ts
  ) => DeepMergeHKT<Ts, GetDeepMergeIntoMergeFunctionsURIs<PMF>, MetaData>;

  const utils: DeepMergeIntoMergeFunctionUtils<MetaData, MetaMetaData> =
    getUtils(options, customizedDeepmerge as CustomizedDeepmergeInto);

  /**
   * The customized deepmerge function.
   */
  function customizedDeepmerge(
    target: unknown,
    ...objects: ReadonlyArray<unknown>
  ) {
    mergeUnknownsInto<
      typeof target,
      ReadonlyArray<unknown>,
      typeof utils,
      GetDeepMergeIntoMergeFunctionsURIs<PMF>,
      MetaData,
      MetaMetaData
    >(target, objects, utils, rootMetaData);
  }

  return customizedDeepmerge as CustomizedDeepmergeInto;
}

/**
 * The the full options with defaults apply.
 *
 * @param options - The options the user specified
 */
function getUtils<M, MM extends Readonly<Record<PropertyKey, unknown>>>(
  options: DeepMergeOptions<M, MM>,
  customizedDeepmerge: DeepMergeIntoMergeFunctionUtils<M, MM>["deepmerge"]
): DeepMergeIntoMergeFunctionUtils<M, MM> {
  return {
    defaultMergeIntoFunctions,
    mergeFunctions: {
      ...defaultMergeIntoFunctions,
      ...Object.fromEntries(
        Object.entries(options)
          .filter(([key, option]) =>
            Object.prototype.hasOwnProperty.call(defaultMergeIntoFunctions, key)
          )
          .map(([key, option]) =>
            option === false ? [key, leaf] : [key, option]
          )
      ),
    } as DeepMergeIntoMergeFunctionUtils<M, MM>["mergeFunctions"],
    metaDataUpdater: (options.metaDataUpdater ??
      defaultMetaDataUpdater) as unknown as DeepMergeIntoMergeFunctionUtils<
      M,
      MM
    >["metaDataUpdater"],
    deepmerge: customizedDeepmerge,
  };
}

/**
 * Merge unknown things.
 *
 * @param values - The values.
 */
function mergeUnknownsInto<
  T,
  Ts extends ReadonlyArray<unknown>,
  U extends DeepMergeIntoMergeFunctionUtils<M, MM>,
  MF extends DeepMergeIntoMergeFunctionsURIs,
  M,
  MM extends Readonly<Record<PropertyKey, unknown>>
>(target: T, values: Ts, utils: U, meta: M | undefined): void {
  if (values.length === 0) {
    return;
  }

  const type = getObjectType(values[0]);

  // eslint-disable-next-line functional/no-conditional-statement -- add an early escape for better performance.
  if (type !== ObjectType.NOT && type !== ObjectType.OTHER) {
    // eslint-disable-next-line functional/no-loop-statement -- using a loop here is more performant than mapping every value and then testing every value.
    for (let mutableIndex = 1; mutableIndex < values.length; mutableIndex++) {
      if (getObjectType(values[mutableIndex]) === type) {
        continue;
      }

      return;
    }
  }

  switch (type) {
    case ObjectType.RECORD:
      return void utils.mergeFunctions.mergeRecordsInto(
        target as unknown as Record<PropertyKey, unknown>,
        values as ReadonlyArray<Readonly<Record<PropertyKey, unknown>>>,
        utils,
        meta
      );

    case ObjectType.ARRAY:
      return void utils.mergeFunctions.mergeArraysInto(
        target as unknown as unknown[],
        values as ReadonlyArray<Readonly<ReadonlyArray<unknown>>>,
        utils,
        meta
      );

    case ObjectType.SET:
      return void utils.mergeFunctions.mergeSetsInto(
        target as unknown as Set<unknown>,
        values as ReadonlyArray<Readonly<ReadonlySet<unknown>>>,
        utils,
        meta
      );

    case ObjectType.MAP:
      return void utils.mergeFunctions.mergeMapsInto(
        target as unknown as Map<unknown, unknown>,
        values as ReadonlyArray<Readonly<ReadonlyMap<unknown, unknown>>>,
        utils,
        meta
      );
  }
}

/**
 * Merge records.
 *
 * @param target - Merge the result into this value.
 * @param values - The records.
 */
function mergeRecordsInto<
  T extends Record<PropertyKey, unknown>,
  Ts extends ReadonlyArray<Record<PropertyKey, unknown>>,
  U extends DeepMergeIntoMergeFunctionUtils<M, MM>,
  MF extends DeepMergeIntoMergeFunctionsURIs,
  M,
  MM extends DeepMergeBuiltInMetaData
>(target: T, values: Ts, utils: U, meta: M | undefined) {
  /* eslint-disable functional/no-loop-statement, functional/no-conditional-statement -- using a loop here is more performant. */
  for (const key of getKeys(values)) {
    const propValues = [];

    for (const value of values) {
      if (objectHasProperty(value, key)) {
        propValues.push(value[key]);
      }
    }

    // assert(propValues.length > 0);

    const updatedMeta = utils.metaDataUpdater(meta, {
      key,
      target,
      parents: values,
    } as unknown as MM);

    if (target[key] !== null && typeof target[key] === "object") {
      return void mergeUnknownsInto<
        unknown,
        ReadonlyArray<unknown>,
        U,
        MF,
        M,
        MM
      >(target[key], propValues, utils, updatedMeta);
    }

    (target as Record<PropertyKey, unknown>)[key] = mergeUnknowns<
      ReadonlyArray<unknown>,
      U,
      MF,
      M,
      MM
    >(propValues, utils, updatedMeta);
  }
  /* eslint-enable functional/no-loop-statement, functional/no-conditional-statement */
}

/**
 * Merge arrays.
 *
 * @param target - Merge the result into this value.
 * @param values - The arrays.
 */
function mergeArraysInto<
  T extends unknown[],
  Ts extends ReadonlyArray<ReadonlyArray<unknown>>
>(target: T, values: Ts) {
  (target as unknown[]).push.apply(target, values.flat());
}

/**
 * Merge sets.
 *
 * @param target - Merge the result into this value.
 * @param values - The sets.
 */
function mergeSetsInto<
  T extends Set<unknown>,
  Ts extends ReadonlyArray<Readonly<ReadonlySet<unknown>>>
>(target: T, values: Ts) {
  for (const value of getIterableOfIterables(values)) {
    target.add(value);
  }
}

/**
 * Merge maps.
 *
 * @param target - Merge the result into this value.
 * @param values - The maps.
 */
function mergeMapsInto<
  T extends Map<unknown, unknown>,
  Ts extends ReadonlyArray<Readonly<ReadonlyMap<unknown, unknown>>>
>(target: T, values: Ts) {
  for (const [key, value] of getIterableOfIterables(values)) {
    target.set(key, value);
  }
}
