import { MetaType } from "../../src/metaType.mjs";

export const meta: MetaType<Struct> = {
  description: `
Title
[hr][/hr]
Description 1[h1][/h1]
Description 2[h1][/h1]
[hr][/hr]
Footer
`,
  changenote: "Initial release",
  structTransformers: [WorldMap_WPTransformer],
};

function WorldMap_WPTransformer(struct: Struct) {
  let fork = struct.fork();

  switch (struct.SpawnType) {
    case "ESpawnType::DestructibleObject": {
      fork = transformDestructibleObjects(struct, fork);
      break;
    }
    case "ESpawnType::PackOfItems":
    case "ESpawnType::Item": {
      fork = transformItems(struct, fork);
      break;
    }
    case "ESpawnType::ItemContainer": {
      fork = rememberAndEmptyStash(struct, fork, context);
      break;
    }
  }

  if (fork && fork.entries().length) {
    return fork;
  }

  return null;
}

WorldMap_WPTransformer.files = ["GameLite/GameData/SpawnActorPrototypes/WorldMap_WP/"];
transformSpawnActorPrototypes.contains = true;
transformSpawnActorPrototypes.contents = [...preplacedDestructibleItems, "Medkit", ...preplacedGear, ...containers];

function transformDestructibleObjects(struct: SpawnActorPrototype, fork: SpawnActorPrototype) {
  if (!(preplacedDestructibleItems.some((i) => struct.SpawnedPrototypeSID?.includes(i)) && struct.ItemGeneratorSettings)) {
    return;
  }

  const igs = struct.ItemGeneratorSettings.map(([_k, e]) => {
    const fork = e.fork();
    const ig = e.ItemGenerators.map(([_k, ie]) => {
      if (!ie?.PrototypeSID) {
        return;
      }

      logger.info(`Found preplaced destructible object: ${ie?.PrototypeSID}. Hiding it.`);
      totals.DestructibleObject++;

      return Object.assign(ie.fork(), { PrototypeSID: "Milk" });
    });

    if (!ig.entries().length) {
      return;
    }

    ig.__internal__.bpatch = true;
    fork.ItemGenerators = ig;
    return fork;
  });
  if (!igs.entries().length) {
    return;
  }
  igs.__internal__.bpatch = true;
  fork.ItemGeneratorSettings = igs;
  return fork;
}

function transformItems(struct: SpawnActorPrototype, fork: SpawnActorPrototype) {
  const isMedkitReplacement = struct.ItemSID?.includes("Medkit") || struct.PackOfItemsPrototypeSID?.includes("Medkit");
  const isGearReplacement = preplacedGear.some((i) => struct.ItemSID?.includes(i)) && !attachmentsOrQuestItems.has(struct.ItemSID);
  if (!(isGearReplacement || isMedkitReplacement)) {
    return;
  }
  logger.info(`Found preplaced Item: ${struct.ItemSID || struct.PackOfItemsPrototypeSID}. Hiding it.`);
  if (isMedkitReplacement) {
    totals.Medkit++;
  }
  totals.Medkit++;
  if (totals.Medkit % 100 === 0) {
    logger.info(`Found ${totals.Medkit} preplaced ${struct.ItemSID || struct.PackOfItemsPrototypeSID}. Hiding it.`);
  }
  if (isGearReplacement) {
    totals.Gear++;
  }
  return Object.assign(fork, { SpawnOnStart: false }) as SpawnActorPrototype;
}

function rememberAndEmptyStash(struct: SpawnActorPrototype, fork: SpawnActorPrototype, context: MetaContext<SpawnActorPrototype>) {
  if (struct.ClueVariablePrototypeSID !== "EmptyInherited" || !containers.has(struct.SpawnedPrototypeSID)) {
    return fork;
  }
  totals.ItemContainer++;
  allStashes[struct.SID] = struct;

  fork.ClueVariablePrototypeSID = getGeneratedStashSID((context.fileIndex % 100) + 1);
  fork.SpawnOnStart = false;

  return fork;
}
