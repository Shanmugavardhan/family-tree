import { Person } from '../types/person';
import { ParentType } from '../types/relationship';
import {
  RelativeItem,
  RelativeCategory,
  DerivedRelativesResponse,
  PerspectiveRelationship,
  PerspectiveRelationshipResult,
} from '../types/relative';
import { FamilyRepository } from '../repositories/family.repository';
import { LocalJsonFamilyRepository } from '../repositories/local-json.repository';
import { ValidationError, NotFoundError } from './errors';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getFullName(p: Person): string {
  const parts = [p.first_name, p.middle_name, p.last_name].filter(Boolean);
  return parts.join(' ');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export class RelativeService {
  private repository: FamilyRepository;

  constructor(repository?: FamilyRepository) {
    this.repository = repository || new LocalJsonFamilyRepository();
  }

  /**
   * Dynamically calculates all derived and direct relatives for a given person.
   * All relationship labels are perspective-dependent: calculated from the focal person's viewpoint.
   */
  async getDerivedRelatives(
    targetId: string,
    options?: {
      type?: RelativeCategory | 'all';
      includeArchived?: boolean;
    }
  ): Promise<DerivedRelativesResponse> {
    if (!UUID_REGEX.test(targetId)) {
      throw new ValidationError('INVALID_UUID', `Person ID "${targetId}" is not a valid UUID.`);
    }

    const typeFilter = options?.type || 'all';
    const includeArchived = options?.includeArchived === true;

    // Load entire graph
    const allPersons = await this.repository.getAllPersons(true);
    const allRelationships = await this.repository.getAllRelationships();

    const target = allPersons.find((p) => p.id === targetId);
    if (!target) {
      throw new NotFoundError('PERSON_NOT_FOUND', `Person with ID "${targetId}" was not found.`);
    }

    if (target.is_archived && !includeArchived) {
      throw new NotFoundError(
        'PERSON_ARCHIVED',
        `Person with ID "${targetId}" is archived. Pass includeArchived=true to calculate relatives.`
      );
    }

    // Build indexing structures
    const personMap = new Map<string, Person>();
    for (const p of allPersons) {
      personMap.set(p.id, p);
    }

    // parentsOf: childId -> list of { parentId, parentType }
    const parentsOf = new Map<string, { parentId: string; parentType: ParentType }[]>();
    // childrenOf: parentId -> list of { childId, parentType }
    const childrenOf = new Map<string, { childId: string; parentType: ParentType }[]>();
    // spousesOf: personId -> list of spouseIds
    const spousesOf = new Map<string, string[]>();

    for (const p of allPersons) {
      parentsOf.set(p.id, []);
      childrenOf.set(p.id, []);
      spousesOf.set(p.id, []);
    }

    for (const rel of allRelationships) {
      if (rel.relationship_type === 'parent') {
        const parents = parentsOf.get(rel.person_id) || [];
        parents.push({ parentId: rel.related_person_id, parentType: rel.parent_type });
        parentsOf.set(rel.person_id, parents);

        const children = childrenOf.get(rel.related_person_id) || [];
        children.push({ childId: rel.person_id, parentType: rel.parent_type });
        childrenOf.set(rel.related_person_id, children);
      } else if (rel.relationship_type === 'spouse') {
        const sp1 = spousesOf.get(rel.person_id) || [];
        sp1.push(rel.related_person_id);
        spousesOf.set(rel.person_id, sp1);

        const sp2 = spousesOf.get(rel.related_person_id) || [];
        sp2.push(rel.person_id);
        spousesOf.set(rel.related_person_id, sp2);
      }
    }

    // Result buckets (keyed by personId for clean deduplication within categories)
    const parentsMap = new Map<string, RelativeItem>();
    const childrenMap = new Map<string, RelativeItem>();
    const spousesMap = new Map<string, RelativeItem>();
    const siblingsMap = new Map<string, RelativeItem>();
    const grandparentsMap = new Map<string, RelativeItem>();
    const grandchildrenMap = new Map<string, RelativeItem>();
    const greatGrandparentsMap = new Map<string, RelativeItem>();
    const unclesAuntsMap = new Map<string, RelativeItem>();
    const nephewsNiecesMap = new Map<string, RelativeItem>();
    const cousinsMap = new Map<string, RelativeItem>();
    const firstCousinsOnceRemovedMap = new Map<string, RelativeItem>();
    const inLawsMap = new Map<string, RelativeItem>();

    const shouldCompute = (cat: RelativeCategory) => typeFilter === 'all' || typeFilter === cat;

    // Helper to safely add/merge item into a category map
    const addRelative = (map: Map<string, RelativeItem>, item: RelativeItem) => {
      const existing = map.get(item.person_id);
      if (existing) {
        for (const p of item.relationship_paths) {
          if (!existing.relationship_paths.includes(p)) {
            existing.relationship_paths.push(p);
          }
        }
        if (item.shared_parent_ids) {
          const merged = new Set([...(existing.shared_parent_ids || []), ...item.shared_parent_ids]);
          existing.shared_parent_ids = Array.from(merged);
        }
      } else {
        map.set(item.person_id, item);
      }
    };

    // 1. PARENTS
    const myParents = parentsOf.get(targetId) || [];
    for (const pEntry of myParents) {
      const parent = personMap.get(pEntry.parentId);
      if (!parent) continue;
      if (parent.is_archived && !includeArchived) continue;

      let label = parent.gender === 'male' ? 'Father' : parent.gender === 'female' ? 'Mother' : 'Parent';
      if (pEntry.parentType && pEntry.parentType !== 'biological') {
        label = `${capitalize(pEntry.parentType)} ${label}`;
      }

      if (shouldCompute('parents')) {
        addRelative(parentsMap, {
          person_id: parent.id,
          full_name: getFullName(parent),
          relationship: label,
          category: 'parents',
          gender: parent.gender,
          is_living: parent.is_living,
          is_archived: parent.is_archived,
          profile_photo: parent.profile_photo,
          lineage_type: pEntry.parentType || 'biological',
          relationship_paths: [label],
        });
      }
    }

    // 2. CHILDREN
    const myChildren = childrenOf.get(targetId) || [];
    for (const cEntry of myChildren) {
      const child = personMap.get(cEntry.childId);
      if (!child) continue;
      if (child.is_archived && !includeArchived) continue;

      let label = child.gender === 'male' ? 'Son' : child.gender === 'female' ? 'Daughter' : 'Child';
      if (cEntry.parentType && cEntry.parentType !== 'biological') {
        label = `${capitalize(cEntry.parentType)} ${label}`;
      }

      if (shouldCompute('children')) {
        addRelative(childrenMap, {
          person_id: child.id,
          full_name: getFullName(child),
          relationship: label,
          category: 'children',
          gender: child.gender,
          is_living: child.is_living,
          is_archived: child.is_archived,
          profile_photo: child.profile_photo,
          lineage_type: cEntry.parentType || 'biological',
          relationship_paths: [label],
        });
      }
    }

    // 3. SPOUSES
    const mySpouses = spousesOf.get(targetId) || [];
    for (const spId of mySpouses) {
      const spouse = personMap.get(spId);
      if (!spouse) continue;
      if (spouse.is_archived && !includeArchived) continue;

      const label = spouse.gender === 'male' ? 'Husband' : spouse.gender === 'female' ? 'Wife' : 'Spouse';

      if (shouldCompute('spouses')) {
        addRelative(spousesMap, {
          person_id: spouse.id,
          full_name: getFullName(spouse),
          relationship: label,
          category: 'spouses',
          gender: spouse.gender,
          is_living: spouse.is_living,
          is_archived: spouse.is_archived,
          profile_photo: spouse.profile_photo,
          lineage_type: 'spouse',
          relationship_paths: [label],
        });
      }
    }

    // 4. SIBLINGS (Full and Half)
    const siblingCandidateMap = new Map<string, { sharedParentIds: Set<string>; lineageTypes: Set<ParentType> }>();

    for (const pEntry of myParents) {
      const coChildren = childrenOf.get(pEntry.parentId) || [];
      for (const child of coChildren) {
        if (child.childId !== targetId) {
          const cand = siblingCandidateMap.get(child.childId) || {
            sharedParentIds: new Set<string>(),
            lineageTypes: new Set<ParentType>(),
          };
          cand.sharedParentIds.add(pEntry.parentId);
          if (pEntry.parentType) cand.lineageTypes.add(pEntry.parentType);
          if (child.parentType) cand.lineageTypes.add(child.parentType);
          siblingCandidateMap.set(child.childId, cand);
        }
      }
    }

    for (const [sId, cand] of siblingCandidateMap.entries()) {
      const sibling = personMap.get(sId);
      if (!sibling) continue;
      if (sibling.is_archived && !includeArchived) continue;

      const isFull = cand.sharedParentIds.size >= 2;
      let label: string;
      if (isFull) {
        label = sibling.gender === 'male' ? 'Brother' : sibling.gender === 'female' ? 'Sister' : 'Sibling';
      } else {
        label =
          sibling.gender === 'male'
            ? 'Half-Brother'
            : sibling.gender === 'female'
            ? 'Half-Sister'
            : 'Half-Sibling';
      }

      const sharedIdsArray = Array.from(cand.sharedParentIds);
      const lineage = cand.lineageTypes.has('adoptive')
        ? 'adoptive'
        : cand.lineageTypes.has('step')
        ? 'step'
        : 'biological';

      if (shouldCompute('siblings')) {
        addRelative(siblingsMap, {
          person_id: sibling.id,
          full_name: getFullName(sibling),
          relationship: label,
          category: 'siblings',
          gender: sibling.gender,
          is_living: sibling.is_living,
          is_archived: sibling.is_archived,
          profile_photo: sibling.profile_photo,
          lineage_type: lineage,
          shared_parent_ids: sharedIdsArray,
          relationship_paths: [isFull ? 'Full Sibling' : 'Half Sibling'],
        });
      }
    }

    // 5. GRANDPARENTS (Parents of parents)
    const grandparentIds = new Set<string>();
    for (const pEntry of myParents) {
      const parent = personMap.get(pEntry.parentId);
      if (!parent) continue;

      const grandparents = parentsOf.get(pEntry.parentId) || [];
      for (const gpEntry of grandparents) {
        grandparentIds.add(gpEntry.parentId);
        const gp = personMap.get(gpEntry.parentId);
        if (!gp) continue;
        if (gp.is_archived && !includeArchived) continue;

        let sidePrefix = '';
        if (parent.gender === 'male') sidePrefix = 'Paternal ';
        else if (parent.gender === 'female') sidePrefix = 'Maternal ';

        const label =
          gp.gender === 'male'
            ? `${sidePrefix}Grandfather`
            : gp.gender === 'female'
            ? `${sidePrefix}Grandmother`
            : `${sidePrefix}Grandparent`;

        const path = `${getFullName(parent)} (${parent.gender === 'male' ? 'Father' : 'Mother'}) -> Parent (${getFullName(gp)})`;

        if (shouldCompute('grandparents')) {
          addRelative(grandparentsMap, {
            person_id: gp.id,
            full_name: getFullName(gp),
            relationship: label,
            category: 'grandparents',
            gender: gp.gender,
            is_living: gp.is_living,
            is_archived: gp.is_archived,
            profile_photo: gp.profile_photo,
            lineage_type: gpEntry.parentType || 'biological',
            relationship_paths: [path],
          });
        }
      }
    }

    // 6. GRANDCHILDREN (Children of children)
    for (const cEntry of myChildren) {
      const child = personMap.get(cEntry.childId);
      if (!child) continue;

      const grandChildren = childrenOf.get(cEntry.childId) || [];
      for (const gcEntry of grandChildren) {
        const gc = personMap.get(gcEntry.childId);
        if (!gc) continue;
        if (gc.is_archived && !includeArchived) continue;

        const label = gc.gender === 'male' ? 'Grandson' : gc.gender === 'female' ? 'Granddaughter' : 'Grandchild';
        const path = `${getFullName(child)} (${child.gender === 'male' ? 'Son' : 'Daughter'}) -> Child (${getFullName(gc)})`;

        if (shouldCompute('grandchildren')) {
          addRelative(grandchildrenMap, {
            person_id: gc.id,
            full_name: getFullName(gc),
            relationship: label,
            category: 'grandchildren',
            gender: gc.gender,
            is_living: gc.is_living,
            is_archived: gc.is_archived,
            profile_photo: gc.profile_photo,
            lineage_type: gcEntry.parentType || 'biological',
            relationship_paths: [path],
          });
        }
      }
    }

    // 7. GREAT-GRANDPARENTS (Parents of grandparents)
    for (const gpId of grandparentIds) {
      const gp = personMap.get(gpId);
      if (!gp) continue;

      const greatGrandparents = parentsOf.get(gpId) || [];
      for (const ggpEntry of greatGrandparents) {
        const ggp = personMap.get(ggpEntry.parentId);
        if (!ggp) continue;
        if (ggp.is_archived && !includeArchived) continue;

        const label =
          ggp.gender === 'male'
            ? 'Great-Grandfather'
            : ggp.gender === 'female'
            ? 'Great-Grandmother'
            : 'Great-Grandparent';
        const path = `${getFullName(gp)} (Grandparent) -> Parent (${getFullName(ggp)})`;

        if (shouldCompute('great_grandparents')) {
          addRelative(greatGrandparentsMap, {
            person_id: ggp.id,
            full_name: getFullName(ggp),
            relationship: label,
            category: 'great_grandparents',
            gender: ggp.gender,
            is_living: ggp.is_living,
            is_archived: ggp.is_archived,
            profile_photo: ggp.profile_photo,
            lineage_type: ggpEntry.parentType || 'biological',
            relationship_paths: [path],
          });
        }
      }
    }

    // 8. UNCLES & AUNTS (Siblings of parents)
    const unclesAuntsIdList: { personId: string; side: 'Paternal' | 'Maternal' | ''; parentName: string }[] = [];

    for (const pEntry of myParents) {
      const parent = personMap.get(pEntry.parentId);
      if (!parent) continue;

      const side: 'Paternal' | 'Maternal' | '' =
        parent.gender === 'male' ? 'Paternal' : parent.gender === 'female' ? 'Maternal' : '';

      const parentParents = parentsOf.get(pEntry.parentId) || [];
      const parentSiblingIds = new Set<string>();

      for (const gp of parentParents) {
        const gpChildren = childrenOf.get(gp.parentId) || [];
        for (const coChild of gpChildren) {
          if (coChild.childId !== pEntry.parentId) {
            parentSiblingIds.add(coChild.childId);
          }
        }
      }

      for (const uaId of parentSiblingIds) {
        const ua = personMap.get(uaId);
        if (!ua) continue;
        unclesAuntsIdList.push({ personId: uaId, side, parentName: getFullName(parent) });

        if (ua.is_archived && !includeArchived) continue;

        const prefix = side ? `${side} ` : '';
        const label =
          ua.gender === 'male' ? `${prefix}Uncle` : ua.gender === 'female' ? `${prefix}Aunt` : `${prefix}Parent's Sibling`;

        const path = `${getFullName(parent)} (${side || 'Parent'}) -> Sibling (${getFullName(ua)})`;

        if (shouldCompute('uncles_aunts')) {
          addRelative(unclesAuntsMap, {
            person_id: ua.id,
            full_name: getFullName(ua),
            relationship: label,
            category: 'uncles_aunts',
            gender: ua.gender,
            is_living: ua.is_living,
            is_archived: ua.is_archived,
            profile_photo: ua.profile_photo,
            lineage_type: 'biological',
            relationship_paths: [path],
          });
        }
      }
    }

    // 9. NEPHEWS & NIECES (Strictly children of siblings)
    for (const sId of siblingCandidateMap.keys()) {
      const sibling = personMap.get(sId);
      if (!sibling) continue;

      const sibChildren = childrenOf.get(sId) || [];
      for (const cEntry of sibChildren) {
        const child = personMap.get(cEntry.childId);
        if (!child) continue;
        if (child.id === targetId) continue;
        if (child.is_archived && !includeArchived) continue;

        const label = child.gender === 'male' ? 'Nephew' : child.gender === 'female' ? 'Niece' : "Sibling's Child";
        const path = `Sibling (${getFullName(sibling)}) -> Child (${getFullName(child)})`;

        if (shouldCompute('nephews_nieces')) {
          addRelative(nephewsNiecesMap, {
            person_id: child.id,
            full_name: getFullName(child),
            relationship: label,
            category: 'nephews_nieces',
            gender: child.gender,
            is_living: child.is_living,
            is_archived: child.is_archived,
            profile_photo: child.profile_photo,
            lineage_type: cEntry.parentType || 'biological',
            relationship_paths: [path],
          });
        }
      }
    }

    // 10. COUSINS (Children of uncles and aunts)
    const cousinIds: { cousinId: string; uncleAuntName: string; side: string }[] = [];
    for (const uaInfo of unclesAuntsIdList) {
      const ua = personMap.get(uaInfo.personId);
      if (!ua) continue;

      const uaChildren = childrenOf.get(uaInfo.personId) || [];
      for (const cEntry of uaChildren) {
        const cousin = personMap.get(cEntry.childId);
        if (!cousin) continue;
        if (cousin.id === targetId) continue; // Not self
        if (siblingCandidateMap.has(cousin.id)) continue; // Not sibling

        cousinIds.push({ cousinId: cousin.id, uncleAuntName: getFullName(ua), side: uaInfo.side });

        if (cousin.is_archived && !includeArchived) continue;

        const prefix = uaInfo.side ? `${uaInfo.side} ` : '';
        const label = `${prefix}Cousin`;
        const path = `${uaInfo.parentName} -> Sibling (${getFullName(ua)}) -> Child (${getFullName(cousin)})`;

        if (shouldCompute('cousins')) {
          addRelative(cousinsMap, {
            person_id: cousin.id,
            full_name: getFullName(cousin),
            relationship: label,
            category: 'cousins',
            gender: cousin.gender,
            is_living: cousin.is_living,
            is_archived: cousin.is_archived,
            profile_photo: cousin.profile_photo,
            lineage_type: cEntry.parentType || 'biological',
            relationship_paths: [path],
          });
        }
      }
    }

    // 11. FIRST COUSINS ONCE REMOVED
    // A) Downward: Children of First Cousins (Cousin's Son / Cousin's Daughter)
    for (const cInfo of cousinIds) {
      const cousin = personMap.get(cInfo.cousinId);
      if (!cousin) continue;

      const cousinChildren = childrenOf.get(cInfo.cousinId) || [];
      for (const ccEntry of cousinChildren) {
        const cc = personMap.get(ccEntry.childId);
        if (!cc) continue;
        if (cc.id === targetId) continue;
        if (cc.is_archived && !includeArchived) continue;

        const subLabel = cc.gender === 'male' ? "Cousin's Son" : cc.gender === 'female' ? "Cousin's Daughter" : "Cousin's Child";
        const label = `First Cousin Once Removed (${subLabel})`;
        const path = `Cousin (${getFullName(cousin)}) -> Child (${getFullName(cc)})`;

        if (shouldCompute('first_cousins_once_removed')) {
          addRelative(firstCousinsOnceRemovedMap, {
            person_id: cc.id,
            full_name: getFullName(cc),
            relationship: label,
            category: 'first_cousins_once_removed',
            gender: cc.gender,
            is_living: cc.is_living,
            is_archived: cc.is_archived,
            profile_photo: cc.profile_photo,
            lineage_type: ccEntry.parentType || 'biological',
            relationship_paths: [path],
          });
        }
      }
    }

    // B) Upward: First Cousins of Parents (Parent's Cousin)
    for (const pEntry of myParents) {
      const parent = personMap.get(pEntry.parentId);
      if (!parent) continue;

      // Grandparent's siblings' children
      const gpList = parentsOf.get(pEntry.parentId) || [];
      for (const gp of gpList) {
        const ggpList = parentsOf.get(gp.parentId) || [];
        for (const ggp of ggpList) {
          const greatUnclesAunts = childrenOf.get(ggp.parentId) || [];
          for (const gua of greatUnclesAunts) {
            if (gua.childId !== gp.parentId) {
              const parentCousins = childrenOf.get(gua.childId) || [];
              for (const pc of parentCousins) {
                const pcPerson = personMap.get(pc.childId);
                if (!pcPerson) continue;
                if (pcPerson.id === targetId) continue;
                if (pcPerson.is_archived && !includeArchived) continue;

                const label = "First Cousin Once Removed (Parent's Cousin)";
                const path = `Parent (${getFullName(parent)}) -> Cousin (${getFullName(pcPerson)})`;

                if (shouldCompute('first_cousins_once_removed')) {
                  addRelative(firstCousinsOnceRemovedMap, {
                    person_id: pcPerson.id,
                    full_name: getFullName(pcPerson),
                    relationship: label,
                    category: 'first_cousins_once_removed',
                    gender: pcPerson.gender,
                    is_living: pcPerson.is_living,
                    is_archived: pcPerson.is_archived,
                    profile_photo: pcPerson.profile_photo,
                    lineage_type: 'biological',
                    relationship_paths: [path],
                  });
                }
              }
            }
          }
        }
      }
    }

    // 12. IN-LAWS (Spouses of blood relatives and relatives of spouse)
    // A) Spouses of Sibling -> Brother-in-law / Sister-in-law
    for (const sId of siblingCandidateMap.keys()) {
      const sibling = personMap.get(sId);
      if (!sibling) continue;

      const sibSpouses = spousesOf.get(sId) || [];
      for (const ssId of sibSpouses) {
        const ss = personMap.get(ssId);
        if (!ss || ss.id === targetId) continue;
        if (ss.is_archived && !includeArchived) continue;

        const label = ss.gender === 'male' ? 'Brother-in-law' : ss.gender === 'female' ? 'Sister-in-law' : 'Sibling-in-law';
        const path = `Sibling (${getFullName(sibling)}) -> Spouse (${getFullName(ss)})`;

        if (shouldCompute('in_laws')) {
          addRelative(inLawsMap, {
            person_id: ss.id,
            full_name: getFullName(ss),
            relationship: label,
            category: 'in_laws',
            gender: ss.gender,
            is_living: ss.is_living,
            is_archived: ss.is_archived,
            profile_photo: ss.profile_photo,
            lineage_type: 'spouse',
            relationship_paths: [path],
          });
        }
      }
    }

    // B) Spouses of Uncles/Aunts -> Uncle (by marriage) / Aunt (by marriage)
    for (const uaInfo of unclesAuntsIdList) {
      const ua = personMap.get(uaInfo.personId);
      if (!ua) continue;

      const uaSpouses = spousesOf.get(uaInfo.personId) || [];
      for (const uasId of uaSpouses) {
        const uas = personMap.get(uasId);
        if (!uas || uas.id === targetId) continue;
        // Don't add if already a blood parent/relative
        if (myParents.some((p) => p.parentId === uasId)) continue;
        if (uas.is_archived && !includeArchived) continue;

        const prefix = uaInfo.side ? `${uaInfo.side} ` : '';
        const label =
          uas.gender === 'male'
            ? `${prefix}Uncle (by marriage)`
            : uas.gender === 'female'
            ? `${prefix}Aunt (by marriage)`
            : `${prefix}Aunt/Uncle (by marriage)`;
        const path = `Uncle/Aunt (${getFullName(ua)}) -> Spouse (${getFullName(uas)})`;

        if (shouldCompute('in_laws')) {
          addRelative(inLawsMap, {
            person_id: uas.id,
            full_name: getFullName(uas),
            relationship: label,
            category: 'in_laws',
            gender: uas.gender,
            is_living: uas.is_living,
            is_archived: uas.is_archived,
            profile_photo: uas.profile_photo,
            lineage_type: 'spouse',
            relationship_paths: [path],
          });
        }
      }
    }

    // C) Spouses of Cousins -> Cousin's Wife / Cousin's Husband
    for (const cInfo of cousinIds) {
      const cousin = personMap.get(cInfo.cousinId);
      if (!cousin) continue;

      const cSpouses = spousesOf.get(cInfo.cousinId) || [];
      for (const csId of cSpouses) {
        const cs = personMap.get(csId);
        if (!cs || cs.id === targetId) continue;
        if (cs.is_archived && !includeArchived) continue;

        const label = cs.gender === 'male' ? "Cousin's Husband" : cs.gender === 'female' ? "Cousin's Wife" : "Cousin's Spouse";
        const path = `Cousin (${getFullName(cousin)}) -> Spouse (${getFullName(cs)})`;

        if (shouldCompute('in_laws')) {
          addRelative(inLawsMap, {
            person_id: cs.id,
            full_name: getFullName(cs),
            relationship: label,
            category: 'in_laws',
            gender: cs.gender,
            is_living: cs.is_living,
            is_archived: cs.is_archived,
            profile_photo: cs.profile_photo,
            lineage_type: 'spouse',
            relationship_paths: [path],
          });
        }
      }
    }

    // D) Relatives of Spouse -> Father-in-law, Mother-in-law, Brother-in-law, Sister-in-law
    for (const spId of mySpouses) {
      const spouse = personMap.get(spId);
      if (!spouse) continue;

      // Parents of spouse
      const spParents = parentsOf.get(spId) || [];
      for (const spp of spParents) {
        const parentOfSpouse = personMap.get(spp.parentId);
        if (!parentOfSpouse || parentOfSpouse.id === targetId) continue;
        if (parentOfSpouse.is_archived && !includeArchived) continue;

        const label = parentOfSpouse.gender === 'male' ? 'Father-in-law' : parentOfSpouse.gender === 'female' ? 'Mother-in-law' : 'Parent-in-law';
        const path = `Spouse (${getFullName(spouse)}) -> Parent (${getFullName(parentOfSpouse)})`;

        if (shouldCompute('in_laws')) {
          addRelative(inLawsMap, {
            person_id: parentOfSpouse.id,
            full_name: getFullName(parentOfSpouse),
            relationship: label,
            category: 'in_laws',
            gender: parentOfSpouse.gender,
            is_living: parentOfSpouse.is_living,
            is_archived: parentOfSpouse.is_archived,
            profile_photo: parentOfSpouse.profile_photo,
            lineage_type: 'spouse',
            relationship_paths: [path],
          });
        }
      }

      // Siblings of spouse
      for (const spp of spParents) {
        const spCoChildren = childrenOf.get(spp.parentId) || [];
        for (const spSib of spCoChildren) {
          if (spSib.childId !== spId && spSib.childId !== targetId) {
            const siblingOfSpouse = personMap.get(spSib.childId);
            if (!siblingOfSpouse) continue;
            if (siblingOfSpouse.is_archived && !includeArchived) continue;

            const label =
              siblingOfSpouse.gender === 'male' ? 'Brother-in-law' : siblingOfSpouse.gender === 'female' ? 'Sister-in-law' : 'Sibling-in-law';
            const path = `Spouse (${getFullName(spouse)}) -> Sibling (${getFullName(siblingOfSpouse)})`;

            if (shouldCompute('in_laws')) {
              addRelative(inLawsMap, {
                person_id: siblingOfSpouse.id,
                full_name: getFullName(siblingOfSpouse),
                relationship: label,
                category: 'in_laws',
                gender: siblingOfSpouse.gender,
                is_living: siblingOfSpouse.is_living,
                is_archived: siblingOfSpouse.is_archived,
                profile_photo: siblingOfSpouse.profile_photo,
                lineage_type: 'spouse',
                relationship_paths: [path],
              });
            }
          }
        }
      }
    }

    // E) Spouses of Children -> Son-in-law / Daughter-in-law
    for (const cEntry of myChildren) {
      const child = personMap.get(cEntry.childId);
      if (!child) continue;

      const childSpouses = spousesOf.get(cEntry.childId) || [];
      for (const csId of childSpouses) {
        const cs = personMap.get(csId);
        if (!cs || cs.id === targetId) continue;
        if (cs.is_archived && !includeArchived) continue;

        const label = cs.gender === 'male' ? 'Son-in-law' : cs.gender === 'female' ? 'Daughter-in-law' : 'Child-in-law';
        const path = `Child (${getFullName(child)}) -> Spouse (${getFullName(cs)})`;

        if (shouldCompute('in_laws')) {
          addRelative(inLawsMap, {
            person_id: cs.id,
            full_name: getFullName(cs),
            relationship: label,
            category: 'in_laws',
            gender: cs.gender,
            is_living: cs.is_living,
            is_archived: cs.is_archived,
            profile_photo: cs.profile_photo,
            lineage_type: 'spouse',
            relationship_paths: [path],
          });
        }
      }
    }

    const parentsList = Array.from(parentsMap.values());
    const childrenList = Array.from(childrenMap.values());
    const spousesList = Array.from(spousesMap.values());
    const siblingsList = Array.from(siblingsMap.values());
    const grandparentsList = Array.from(grandparentsMap.values());
    const grandchildrenList = Array.from(grandchildrenMap.values());
    const greatGrandparentsList = Array.from(greatGrandparentsMap.values());
    const unclesAuntsList = Array.from(unclesAuntsMap.values());
    const nephewsNiecesList = Array.from(nephewsNiecesMap.values());
    const cousinsList = Array.from(cousinsMap.values());
    const firstCousinsOnceRemovedList = Array.from(firstCousinsOnceRemovedMap.values());
    const inLawsList = Array.from(inLawsMap.values());

    const totalCount =
      parentsList.length +
      childrenList.length +
      spousesList.length +
      siblingsList.length +
      grandparentsList.length +
      grandchildrenList.length +
      greatGrandparentsList.length +
      unclesAuntsList.length +
      nephewsNiecesList.length +
      cousinsList.length +
      firstCousinsOnceRemovedList.length +
      inLawsList.length;

    // Build perspective relationship map for quick lookup
    const allRelationshipsMap: Record<string, PerspectiveRelationship> = {};
    const allLists: { list: RelativeItem[]; category: RelativeCategory }[] = [
      { list: parentsList, category: 'parents' },
      { list: childrenList, category: 'children' },
      { list: spousesList, category: 'spouses' },
      { list: siblingsList, category: 'siblings' },
      { list: grandparentsList, category: 'grandparents' },
      { list: grandchildrenList, category: 'grandchildren' },
      { list: greatGrandparentsList, category: 'great_grandparents' },
      { list: unclesAuntsList, category: 'uncles_aunts' },
      { list: nephewsNiecesList, category: 'nephews_nieces' },
      { list: cousinsList, category: 'cousins' },
      { list: firstCousinsOnceRemovedList, category: 'first_cousins_once_removed' },
      { list: inLawsList, category: 'in_laws' },
    ];

    for (const group of allLists) {
      for (const item of group.list) {
        if (!allRelationshipsMap[item.person_id]) {
          allRelationshipsMap[item.person_id] = {
            person_id: item.person_id,
            full_name: item.full_name,
            gender: item.gender,
            relationship: item.relationship,
            category: group.category,
            path: item.relationship_paths,
          };
        }
      }
    }

    return {
      person_id: target.id,
      target_person: {
        id: target.id,
        full_name: getFullName(target),
        gender: target.gender,
      },
      relatives: {
        parents: parentsList,
        children: childrenList,
        spouses: spousesList,
        siblings: siblingsList,
        grandparents: grandparentsList,
        grandchildren: grandchildrenList,
        great_grandparents: greatGrandparentsList,
        uncles_aunts: unclesAuntsList,
        nephews_nieces: nephewsNiecesList,
        cousins: cousinsList,
        first_cousins_once_removed: firstCousinsOnceRemovedList,
        in_laws: inLawsList,
      },
      all_relationships: allRelationshipsMap,
      total_count: totalCount,
    };
  }

  /**
   * Calculates the exact relationship between two persons from the source person's perspective,
   * as well as the reverse relationship from the target person's perspective.
   */
  async calculateRelationshipBetween(
    sourceId: string,
    targetId: string
  ): Promise<PerspectiveRelationshipResult> {
    if (!UUID_REGEX.test(sourceId)) {
      throw new ValidationError('INVALID_UUID', `Source ID "${sourceId}" is not a valid UUID.`);
    }
    if (!UUID_REGEX.test(targetId)) {
      throw new ValidationError('INVALID_UUID', `Target ID "${targetId}" is not a valid UUID.`);
    }

    const allPersons = await this.repository.getAllPersons(true);
    const sourcePerson = allPersons.find((p) => p.id === sourceId);
    if (!sourcePerson) {
      throw new NotFoundError('PERSON_NOT_FOUND', `Person with ID "${sourceId}" was not found.`);
    }
    const targetPerson = allPersons.find((p) => p.id === targetId);
    if (!targetPerson) {
      throw new NotFoundError('PERSON_NOT_FOUND', `Person with ID "${targetId}" was not found.`);
    }

    if (sourceId === targetId) {
      return {
        from_person: {
          id: sourcePerson.id,
          full_name: getFullName(sourcePerson),
          gender: sourcePerson.gender,
        },
        to_person: {
          id: targetPerson.id,
          full_name: getFullName(targetPerson),
          gender: targetPerson.gender,
        },
        relationship: 'Self',
        reverse_relationship: 'Self',
        category: 'self',
        path: ['Self'],
      };
    }

    // Compute derived relatives from source perspective
    const sourceDerivations = await this.getDerivedRelatives(sourceId, { includeArchived: true });
    // Compute derived relatives from target perspective
    const targetDerivations = await this.getDerivedRelatives(targetId, { includeArchived: true });

    const directFromSource = sourceDerivations.all_relationships?.[targetId];
    const directFromTarget = targetDerivations.all_relationships?.[sourceId];

    if (directFromSource && directFromTarget) {
      return {
        from_person: {
          id: sourcePerson.id,
          full_name: getFullName(sourcePerson),
          gender: sourcePerson.gender,
        },
        to_person: {
          id: targetPerson.id,
          full_name: getFullName(targetPerson),
          gender: targetPerson.gender,
        },
        relationship: directFromSource.relationship,
        reverse_relationship: directFromTarget.relationship,
        category: directFromSource.category,
        path: directFromSource.path,
      };
    }

    if (directFromSource) {
      return {
        from_person: {
          id: sourcePerson.id,
          full_name: getFullName(sourcePerson),
          gender: sourcePerson.gender,
        },
        to_person: {
          id: targetPerson.id,
          full_name: getFullName(targetPerson),
          gender: targetPerson.gender,
        },
        relationship: directFromSource.relationship,
        reverse_relationship: 'Relative',
        category: directFromSource.category,
        path: directFromSource.path,
      };
    }

    // Default if beyond current search depth
    return {
      from_person: {
        id: sourcePerson.id,
        full_name: getFullName(sourcePerson),
        gender: sourcePerson.gender,
      },
      to_person: {
        id: targetPerson.id,
        full_name: getFullName(targetPerson),
        gender: targetPerson.gender,
      },
      relationship: 'Distant Relative / Unconnected',
      reverse_relationship: 'Distant Relative / Unconnected',
      category: 'unrelated',
      path: [],
    };
  }
}
