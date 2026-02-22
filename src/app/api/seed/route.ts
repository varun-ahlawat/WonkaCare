import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asJson = (v: unknown) => sql.json(v as any);

export async function POST() {
  try {
    // ── Patients ──────────────────────────────────────────────────────────────
    const patients = [
      {
        id: 'p001', mrn: 'MRN-847291', name: 'Oompa Loompa', age: 37, sex: 'M',
        phone: '***-***-9134', primaryDoctor: 'Dr. Sarah Chen',
        allergies: ['Penicillin', 'Sulfa drugs'], riskLevel: 'HIGH', status: 'Critical',
        lastContact: '2026-02-20T20:23:00Z',
        conditions: [
          { name: 'Coronary artery disease', diagnosedDate: '2023-03-15', status: 'Chronic' },
          { name: 'Hypertension', diagnosedDate: '2018-06-20', status: 'Chronic' },
          { name: 'Type 2 Diabetes', diagnosedDate: '2020-11-10', status: 'Chronic' },
        ],
        medications: [
          { name: 'Aspirin', dosage: '81mg', frequency: 'Daily', startedDate: '2023-03-15' },
          { name: 'Metoprolol', dosage: '50mg', frequency: 'Twice daily', startedDate: '2023-03-15' },
          { name: 'Atorvastatin', dosage: '40mg', frequency: 'Daily', startedDate: '2023-03-20' },
          { name: 'Metformin', dosage: '1000mg', frequency: 'Twice daily', startedDate: '2020-11-10' },
        ],
        priorEpisodes: ['Stent placement (LAD) - March 2023', 'Chest pain episode requiring ER visit - Jan 2025'],
      },
      {
        id: 'p002', mrn: 'MRN-592847', name: 'Megan Silva', age: 29, sex: 'F',
        phone: '***-***-2281', primaryDoctor: 'Dr. James Park',
        allergies: ['Latex'], riskLevel: 'MED', status: 'Active',
        lastContact: '2026-02-20T20:24:00Z',
        conditions: [{ name: 'Pregnancy (8 weeks)', diagnosedDate: '2026-01-15', status: 'Active' }],
        medications: [{ name: 'Prenatal vitamins', dosage: '1 tablet', frequency: 'Daily', startedDate: '2026-01-15' }],
        priorEpisodes: [],
      },
      {
        id: 'p003', mrn: 'MRN-103948', name: 'Robert Chen', age: 58, sex: 'M',
        phone: '***-***-4521', primaryDoctor: 'Dr. Sarah Chen',
        allergies: [], riskLevel: 'HIGH', status: 'Critical',
        lastContact: '2026-02-18T08:30:00Z',
        conditions: [
          { name: 'Atrial fibrillation', diagnosedDate: '2022-08-10', status: 'Chronic' },
          { name: 'COPD', diagnosedDate: '2019-04-12', status: 'Chronic' },
        ],
        medications: [
          { name: 'Warfarin', dosage: '5mg', frequency: 'Daily', startedDate: '2022-08-10' },
          { name: 'Albuterol inhaler', dosage: '2 puffs', frequency: 'As needed', startedDate: '2019-04-12' },
        ],
        priorEpisodes: ['Hospitalization for AFib - Aug 2022'],
      },
      {
        id: 'p004', mrn: 'MRN-748392', name: 'Linda Foster', age: 47, sex: 'F',
        phone: '***-***-4478', primaryDoctor: 'Dr. Michael Torres',
        allergies: ['Aspirin'], riskLevel: 'LOW', status: 'Stable',
        lastContact: '2026-02-18T09:15:00Z',
        conditions: [{ name: 'Depression', diagnosedDate: '2024-09-01', status: 'Active' }],
        medications: [{ name: 'Sertraline', dosage: '50mg', frequency: 'Daily', startedDate: '2024-09-01' }],
        priorEpisodes: [],
      },
      {
        id: 'p005', mrn: 'MRN-291847', name: 'Catherine Bell', age: 82, sex: 'F',
        phone: '***-***-7703', primaryDoctor: 'Dr. Sarah Chen',
        allergies: ['Codeine', 'NSAIDs'], riskLevel: 'HIGH', status: 'Critical',
        lastContact: '2026-02-20T20:21:00Z',
        conditions: [
          { name: 'Dementia', diagnosedDate: '2023-02-10', status: 'Chronic' },
          { name: 'Osteoporosis', diagnosedDate: '2020-05-15', status: 'Chronic' },
          { name: 'Hypertension', diagnosedDate: '2015-03-20', status: 'Chronic' },
        ],
        medications: [
          { name: 'Donepezil', dosage: '10mg', frequency: 'Daily', startedDate: '2023-02-10' },
          { name: 'Amlodipine', dosage: '5mg', frequency: 'Daily', startedDate: '2015-03-20' },
          { name: 'Calcium + Vitamin D', dosage: '1 tablet', frequency: 'Daily', startedDate: '2020-05-15' },
        ],
        priorEpisodes: ['Fall with hip fracture - May 2024'],
      },
      {
        id: 'p006', mrn: 'MRN-638291', name: 'Thomas Wright', age: 45, sex: 'M',
        phone: '***-***-8821', primaryDoctor: 'Dr. James Park',
        allergies: [], riskLevel: 'MED', status: 'Follow-up needed',
        lastContact: '2026-02-17T14:20:00Z',
        conditions: [{ name: 'Chronic back pain', diagnosedDate: '2021-07-15', status: 'Chronic' }],
        medications: [{ name: 'Ibuprofen', dosage: '400mg', frequency: 'As needed', startedDate: '2021-07-15' }],
        priorEpisodes: ['MRI lumbar spine - July 2021'],
      },
      {
        id: 'p007', mrn: 'MRN-847201', name: 'Maria Rodriguez', age: 34, sex: 'F',
        phone: '***-***-3392', primaryDoctor: 'Dr. Michael Torres',
        allergies: ['Shellfish'], riskLevel: 'LOW', status: 'Stable',
        lastContact: '2026-02-17T10:45:00Z',
        conditions: [], medications: [], priorEpisodes: [],
      },
      {
        id: 'p008', mrn: 'MRN-492018', name: 'James Mitchell', age: 66, sex: 'M',
        phone: '***-***-5512', primaryDoctor: 'Dr. Sarah Chen',
        allergies: ['Iodine contrast'], riskLevel: 'MED', status: 'Active',
        lastContact: '2026-02-18T07:30:00Z',
        conditions: [
          { name: 'Hyperlipidemia', diagnosedDate: '2019-03-10', status: 'Chronic' },
          { name: 'Prediabetes', diagnosedDate: '2024-01-15', status: 'Active' },
        ],
        medications: [{ name: 'Simvastatin', dosage: '20mg', frequency: 'Daily', startedDate: '2019-03-10' }],
        priorEpisodes: [],
      },
      {
        id: 'p009', mrn: 'MRN-738291', name: 'Patricia Green', age: 52, sex: 'F',
        phone: '***-***-9921', primaryDoctor: 'Dr. James Park',
        allergies: [], riskLevel: 'LOW', status: 'Stable',
        lastContact: '2026-02-16T16:00:00Z',
        conditions: [{ name: 'Hypothyroidism', diagnosedDate: '2018-11-20', status: 'Chronic' }],
        medications: [{ name: 'Levothyroxine', dosage: '75mcg', frequency: 'Daily', startedDate: '2018-11-20' }],
        priorEpisodes: [],
      },
      {
        id: 'p010', mrn: 'MRN-102938', name: 'David Kim', age: 41, sex: 'M',
        phone: '***-***-6634', primaryDoctor: 'Dr. Michael Torres',
        allergies: ['Morphine'], riskLevel: 'MED', status: 'Follow-up needed',
        lastContact: '2026-02-17T11:20:00Z',
        conditions: [{ name: 'Migraine disorder', diagnosedDate: '2020-06-10', status: 'Chronic' }],
        medications: [{ name: 'Sumatriptan', dosage: '50mg', frequency: 'As needed', startedDate: '2020-06-10' }],
        priorEpisodes: ['ER visit for severe migraine - Dec 2025'],
      },
    ];

    let patientsInserted = 0;
    for (const p of patients) {
      await sql`
        INSERT INTO patients (
          id, mrn, name, age, sex, phone, primary_doctor, allergies,
          risk_level, status, conditions, medications, prior_episodes,
          last_contact, last_updated
        ) VALUES (
          ${p.id}, ${p.mrn}, ${p.name}, ${p.age}, ${p.sex}, ${p.phone},
          ${p.primaryDoctor}, ${asJson(p.allergies)}, ${p.riskLevel}, ${p.status},
          ${asJson(p.conditions)}, ${asJson(p.medications)}, ${asJson(p.priorEpisodes)},
          ${p.lastContact}, NOW()
        )
        ON CONFLICT DO NOTHING
      `;
      patientsInserted++;
    }

    // ── Encounters ────────────────────────────────────────────────────────────
    const encounters = [
      { id: 'enc001', patientId: 'p001', type: 'call', timestamp: '2026-02-20T20:23:00Z', chiefComplaint: 'Chest tightness radiating to jaw', symptoms: [{ name: 'Chest tightness', severity: 'Severe', onset: '10 minutes ago' }, { name: 'Jaw pain', severity: 'Moderate', onset: '10 minutes ago' }, { name: 'Diaphoresis', severity: 'Moderate', onset: '10 minutes ago' }], triageLevel: 'HIGH', outcome: 'Triage call completed' },
      { id: 'enc002', patientId: 'p002', type: 'call', timestamp: '2026-02-20T20:24:00Z', chiefComplaint: 'Abdominal cramps with vaginal spotting (8 weeks pregnant)', symptoms: [{ name: 'Lower abdominal pain', severity: 'Severe', onset: '2 hours ago' }, { name: 'Vaginal spotting', severity: 'Mild', onset: '1 hour ago' }, { name: 'Nausea', severity: 'Mild', onset: '2 hours ago' }], triageLevel: 'MED', outcome: 'Monitoring for ectopic pregnancy risk' },
      { id: 'enc003', patientId: 'p003', type: 'call', timestamp: '2026-02-18T08:30:00Z', chiefComplaint: 'Shortness of breath worsening over 2 days', symptoms: [{ name: 'Dyspnea', severity: 'Severe', onset: '2 days ago' }, { name: 'Productive cough', severity: 'Moderate', onset: '3 days ago' }, { name: 'Fatigue', severity: 'Moderate', onset: '2 days ago' }], triageLevel: 'HIGH', outcome: 'Escalated to ER - possible COPD exacerbation' },
      { id: 'enc004', patientId: 'p005', type: 'call', timestamp: '2026-02-20T20:21:00Z', chiefComplaint: 'Unresponsive after taking evening medications', symptoms: [{ name: 'Altered consciousness', severity: 'Severe', onset: '15 minutes ago' }], triageLevel: 'HIGH', outcome: 'EMS dispatched' },
      { id: 'enc005', patientId: 'p006', type: 'call', timestamp: '2026-02-17T14:20:00Z', chiefComplaint: 'Lower back pain radiating to left leg', symptoms: [{ name: 'Lower back pain', severity: 'Severe', onset: '3 days ago' }, { name: 'Left leg numbness', severity: 'Moderate', onset: '2 days ago' }], triageLevel: 'MED', outcome: 'Scheduled urgent care visit' },
      { id: 'enc006', patientId: 'p008', type: 'call', timestamp: '2026-02-18T07:30:00Z', chiefComplaint: 'Dizziness and lightheadedness', symptoms: [{ name: 'Dizziness', severity: 'Moderate', onset: 'This morning' }, { name: 'Lightheadedness', severity: 'Moderate', onset: 'This morning' }], triageLevel: 'MED', outcome: 'Advised to check blood pressure' },
      { id: 'enc007', patientId: 'p010', type: 'call', timestamp: '2026-02-17T11:20:00Z', chiefComplaint: 'Severe migraine unresponsive to usual medication', symptoms: [{ name: 'Severe headache', severity: 'Severe', onset: '6 hours ago' }, { name: 'Photophobia', severity: 'Moderate', onset: '6 hours ago' }, { name: 'Nausea', severity: 'Moderate', onset: '5 hours ago' }], triageLevel: 'MED', outcome: 'Prescribed alternative medication' },
    ];

    let encInserted = 0;
    for (const e of encounters) {
      await sql`
        INSERT INTO encounters (id, patient_id, type, timestamp, chief_complaint, symptoms, triage_level, outcome)
        VALUES (${e.id}, ${e.patientId}, ${e.type}, ${e.timestamp}, ${e.chiefComplaint}, ${asJson(e.symptoms)}, ${e.triageLevel}, ${e.outcome})
        ON CONFLICT DO NOTHING
      `;
      encInserted++;
    }

    // ── Timeline events ───────────────────────────────────────────────────────
    const timeline = [
      { id: 'evt001', patientId: 'p001', type: 'call', timestamp: '2026-02-20T20:23:00Z', title: 'Triage call - Heart Attack', description: 'Patient reports chest tightness radiating to jaw with diaphoresis. History of CAD with prior stent.', metadata: { triageLevel: 'HIGH' } },
      { id: 'evt002', patientId: 'p001', type: 'test', timestamp: '2026-02-18T09:00:00Z', title: 'ECG ordered', description: 'Stat ECG ordered due to chest pain symptoms', metadata: {} },
      { id: 'evt003', patientId: 'p001', type: 'test', timestamp: '2026-02-11T14:30:00Z', title: 'Lipid panel results', description: 'Abnormal - Total cholesterol 245, LDL 165 (High)', metadata: {} },
      { id: 'evt004', patientId: 'p001', type: 'medication', timestamp: '2026-02-12T10:00:00Z', title: 'Atorvastatin dose increased', description: 'Increased from 20mg to 40mg daily due to elevated LDL', metadata: {} },
      { id: 'evt005', patientId: 'p001', type: 'visit', timestamp: '2026-01-15T14:00:00Z', title: 'Cardiology follow-up', description: 'Routine post-stent follow-up. Patient stable, no chest pain reported.', metadata: {} },
      { id: 'evt006', patientId: 'p002', type: 'call', timestamp: '2026-02-20T20:24:00Z', title: 'Triage call - Pregnancy complications', description: 'Severe abdominal cramps with spotting at 8 weeks.', metadata: { triageLevel: 'MED' } },
      { id: 'evt007', patientId: 'p002', type: 'test', timestamp: '2026-02-15T16:00:00Z', title: 'hCG results', description: 'Quantitative hCG: 12,450 mIU/mL - consistent with 8-week gestation', metadata: {} },
      { id: 'evt008', patientId: 'p003', type: 'call', timestamp: '2026-02-18T08:30:00Z', title: 'Triage call - Shortness of breath', description: 'Worsening dyspnea over 2 days with productive cough. Escalated to ER.', metadata: { triageLevel: 'HIGH' } },
      { id: 'evt009', patientId: 'p003', type: 'escalation', timestamp: '2026-02-18T09:15:00Z', title: 'Escalated to ER', description: 'Possible COPD exacerbation - patient advised to go to ER immediately', metadata: {} },
      { id: 'evt010', patientId: 'p005', type: 'call', timestamp: '2026-02-20T20:21:00Z', title: 'Triage call - Altered consciousness', description: 'Daughter reports mother unresponsive after evening medications. EMS dispatched.', metadata: { triageLevel: 'HIGH' } },
      { id: 'evt011', patientId: 'p006', type: 'call', timestamp: '2026-02-17T14:20:00Z', title: 'Triage call - Back pain', description: 'Severe lower back pain radiating to left leg with numbness', metadata: { triageLevel: 'MED' } },
      { id: 'evt012', patientId: 'p008', type: 'call', timestamp: '2026-02-18T07:30:00Z', title: 'Triage call - Dizziness', description: 'Dizziness and lightheadedness this morning', metadata: { triageLevel: 'MED' } },
      { id: 'evt013', patientId: 'p010', type: 'call', timestamp: '2026-02-17T11:20:00Z', title: 'Triage call - Severe migraine', description: 'Migraine unresponsive to usual sumatriptan', metadata: { triageLevel: 'MED' } },
      { id: 'evt014', patientId: 'p010', type: 'medication', timestamp: '2026-02-17T12:00:00Z', title: 'Alternative medication prescribed', description: 'Prescribed rizatriptan 10mg as alternative', metadata: {} },
    ];

    let evtInserted = 0;
    for (const e of timeline) {
      await sql`
        INSERT INTO timeline_events (id, patient_id, type, timestamp, title, description, metadata)
        VALUES (${e.id}, ${e.patientId}, ${e.type}, ${e.timestamp}, ${e.title}, ${e.description}, ${asJson(e.metadata)})
        ON CONFLICT DO NOTHING
      `;
      evtInserted++;
    }

    // ── Doctor notes ──────────────────────────────────────────────────────────
    const notes = [
      { id: 'note001', patientId: 'p001', authorId: 'doc1', authorName: 'Dr. Sarah Chen', createdAt: '2026-02-12T10:30:00Z', content: 'Patient responding well to increased statin dose. LDL still elevated but trending down. Continue current regimen and recheck lipids in 3 months.' },
      { id: 'note002', patientId: 'p001', authorId: 'doc1', authorName: 'Dr. Sarah Chen', createdAt: '2026-01-15T14:45:00Z', content: 'Routine cardiology follow-up. Patient reports good compliance with medications. No chest pain since stent placement. Exercise tolerance improving.' },
      { id: 'note003', patientId: 'p003', authorId: 'doc1', authorName: 'Dr. Sarah Chen', createdAt: '2026-02-10T11:00:00Z', content: 'COPD management review. PFT shows moderate obstruction. Patient using rescue inhaler 3-4x/week. Consider adding LABA/LAMA combination.' },
      { id: 'note004', patientId: 'p005', authorId: 'doc1', authorName: 'Dr. Sarah Chen', createdAt: '2026-02-05T09:30:00Z', content: 'Dementia progression noted by family. Daughter reports increased confusion in evenings. Donepezil dose stable. Discussed caregiver support resources.' },
      { id: 'note005', patientId: 'p006', authorId: 'doc2', authorName: 'Dr. James Park', createdAt: '2026-02-16T16:00:00Z', content: 'Chronic back pain follow-up. Patient reports pain 6/10, worse with prolonged sitting. Physical therapy referral made. Continue NSAIDs as needed.' },
      { id: 'note006', patientId: 'p010', authorId: 'doc3', authorName: 'Dr. Michael Torres', createdAt: '2026-02-16T10:00:00Z', content: 'Migraine frequency increasing - now 3-4 episodes/month. Discussed preventive options. Patient prefers to try magnesium supplementation first.' },
    ];

    let notesInserted = 0;
    for (const n of notes) {
      await sql`
        INSERT INTO doctor_notes (id, patient_id, author_id, author_name, created_at, content)
        VALUES (${n.id}, ${n.patientId}, ${n.authorId}, ${n.authorName}, ${n.createdAt}, ${n.content})
        ON CONFLICT DO NOTHING
      `;
      notesInserted++;
    }

    return NextResponse.json({
      ok: true,
      inserted: { patients: patientsInserted, encounters: encInserted, timelineEvents: evtInserted, doctorNotes: notesInserted },
    });
  } catch (err) {
    console.error('[Seed] Error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
