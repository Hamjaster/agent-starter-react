import type { Extraction } from '@/lib/extract';
import { dedupe, joinList, splitList } from '@/lib/profile-fields';
import type { HealthDocument, Profile, Relation, Sex } from '@/lib/saathi-store';

/** A profile while it's being edited: lists as arrays, id only once saved. */
export interface ProfileDraft {
  id?: string;
  name: string;
  relation: Relation;
  age: string;
  sex: Sex;
  phone: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  history: string;
  documents: HealthDocument[];
}

export function emptyDraft(relation: Relation = 'self'): ProfileDraft {
  return {
    name: '',
    relation,
    age: '',
    sex: '',
    phone: '',
    conditions: [],
    medications: [],
    allergies: [],
    history: '',
    documents: [],
  };
}

export function draftFromProfile(p: Profile): ProfileDraft {
  return {
    id: p.id,
    name: p.name,
    relation: p.relation,
    age: p.age,
    sex: p.sex,
    phone: p.phone,
    conditions: splitList('conditions', p.conditions),
    medications: splitList('medications', p.medications),
    allergies: splitList('allergies', p.allergies),
    history: p.history ?? '',
    documents: p.documents ?? [],
  };
}

export function profileFromDraft(d: ProfileDraft): Omit<Profile, 'id'> & { id?: string } {
  return {
    ...(d.id ? { id: d.id } : {}),
    name: d.name.trim(),
    relation: d.relation,
    age: d.age.trim(),
    sex: d.sex,
    phone: d.phone.trim(),
    conditions: joinList('conditions', d.conditions),
    medications: joinList('medications', d.medications),
    allergies: joinList('allergies', d.allergies),
    history: d.history.trim(),
    documents: d.documents,
  };
}

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Folds what doctor.ai read into a draft. Lists and documents are added to; single fields
 * (name, age…) are only filled when still empty, so nothing the patient typed is overwritten.
 */
export function mergeExtraction(d: ProfileDraft, x: Extraction): ProfileDraft {
  const now = Date.now();
  return {
    ...d,
    name: d.name || x.name,
    relation: x.relation && !d.name ? x.relation : d.relation,
    age: d.age || x.age,
    sex: d.sex || x.sex,
    phone: d.phone || x.phone,
    conditions: dedupe([...d.conditions, ...x.conditions]),
    medications: dedupe([...d.medications, ...x.medications]),
    allergies: dedupe([...d.allergies, ...x.allergies]),
    history: [d.history, x.history].filter((s) => s.trim()).join(' '),
    documents: [...d.documents, ...x.documents.map((doc) => ({ ...doc, id: uid(), addedAt: now }))],
  };
}

/** The profile in plain words, sent as context when more documents are read later. */
export function draftContext(d: ProfileDraft) {
  return [
    d.name && `Name: ${d.name}`,
    d.age && `Age: ${d.age}`,
    d.sex && `Sex: ${d.sex}`,
    d.conditions.length && `Conditions: ${d.conditions.join(', ')}`,
    d.medications.length && `Medicines: ${d.medications.join('; ')}`,
    d.allergies.length && `Allergies: ${d.allergies.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');
}
