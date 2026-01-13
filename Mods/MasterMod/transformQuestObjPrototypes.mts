import { ObjPrototype } from "s2cfgtojson";

import { StructTransformer } from "../../src/meta-type.mts";
import { guideQuestObjectPrototypeSIDs } from "../../src/consts.mts";

/**
 * Adds trade prototypes to all technicians and guides.
 */
export const transformQuestObjPrototypes: StructTransformer<ObjPrototype> = async (struct) => {
  if (techniciansAndTheirTradePrototypes.has(struct.SID)) {
    const fork = Object.assign(struct.fork(), {
      TradePrototypeSID: techniciansAndTheirTradePrototypes.get(struct.SID),
    });
    if (!struct.ItemGeneratorPrototypeSID) {
      fork.ItemGeneratorPrototypeSID = "MainTraderItemGeneratorV1";
    }
    return fork;
  }
  if (guidesAndTheirTradePrototypes[struct.SID]) {
    const fork = Object.assign(struct.fork(), { TradePrototypeSID: guidesAndTheirTradePrototypes[struct.SID] });
    if (!struct.ItemGeneratorPrototypeSID) {
      fork.ItemGeneratorPrototypeSID = "MainTraderItemGeneratorV1";
    }
    return fork;
  }
};
transformQuestObjPrototypes.files = ["/QuestObjPrototypes.cfg"];

const techniciansAndTheirTradePrototypes = new Map([
  ["RostokTechnician", "Technician_ChemicalPlant_TradePrototype"],
  ["DiggerKonder", "Asylum_Technician_TradePrototype"],
  ["ZalesieTechnician", "Asylum_Technician_TradePrototype"],
  ["SkadovskTechnician", "PowerPlugTechnician_TradeItemGenerator"],
  ["ShipyardTechnician", "Asylum_Technician_TradePrototype"],
  ["HimzavodTechnician", "Technician_ChemicalPlant_TradePrototype"],
  ["MalachitTechnician", "PowerPlugTechnician_TradeItemGenerator"],
  ["ConcretePlantTechnician", "PowerPlugTechnician_TradeItemGenerator"],
  ["MagnetMemoryPlantTechnician", "PowerPlugTechnician_TradeItemGenerator"],
  ["SparkWorkshopTechnician", "PowerPlugTechnician_TradeItemGenerator"],
  ["Hors", "Technician_ChemicalPlant_TradePrototype"],
  ["Lesnik", "PowerPlugTechnician_TradeItemGenerator"],
  ["Kardan", "PowerPlugTechnician_TradeItemGenerator"],
  ["FlameStepsel", "PowerPlugTechnician_TradeItemGenerator"],
  ["AzimutVartaAntonMarusin", "Technician_ChemicalPlant_TradePrototype"],
  ["VartaSerzEremeev", "Technician_ChemicalPlant_TradePrototype"],
  ["VartaSergeantVeremeev", "Technician_ChemicalPlant_TradePrototype"],
  ["NeutralDadkaAr", "Technician_ChemicalPlant_TradePrototype"],
  ["SIRCAATechnician", "Technician_ChemicalPlant_TradePrototype"],
  ["NeutralKovyraska", "Technician_ChemicalPlant_TradePrototype"],
  ["VartaSerzantIvajlov", "Technician_ChemicalPlant_TradePrototype"],
  ["CorpMedlak", "PowerPlugTechnician_TradeItemGenerator"],
  ["FlameStepsel_Pripyat", "PowerPlugTechnician_TradeItemGenerator"],
  ["VartaSerzantIvajlov_Pripyat", "PowerPlugTechnician_TradeItemGenerator"],
  ["NeutralMultik", "Asylum_Technician_TradePrototype"],
  ["NeutralSemenyc", "Asylum_Technician_TradePrototype"],
  ["DutySerzantHmaruk", "Technician_ChemicalPlant_TradePrototype"],
  ["CorpusGarpia", "Technician_Yanov_TradePrototype"],
  ["CorpusMedlak", "PowerPlugTechnician_TradeItemGenerator"],
  ["banzai", "PowerPlugTechnician_TradeItemGenerator"],
]);

const guidesAndTheirTradePrototypes = Object.fromEntries([...guideQuestObjectPrototypeSIDs].map((e) => [e, "Guide_TradePrototype"]));
