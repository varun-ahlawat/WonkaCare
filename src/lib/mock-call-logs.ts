export type TriageLevel = 'HIGH' | 'MED' | 'LOW';
export type CallStatus = 'Needs review' | 'Escalated' | 'Resolved' | 'Live';

export interface Agent {
  id: string;
  name: string;
  status: 'Online' | 'Offline';
}

export interface TranscriptLine {
  timestamp: string;
  speaker: 'Agent' | 'Caller';
  text: string;
}

export interface CallLog {
  id: string;
  agentId: string;
  createdAt: string;
  durationSec: number;
  callerPhone: string;
  patientName?: string;
  age?: number;
  sex?: 'M' | 'F';
  zipCode?: string;
  triageLevel: TriageLevel;
  reasonShort: string;
  chiefComplaint: string;
  symptoms: string[];
  riskFlags: string[];
  summary: string;
  recommendation: string;
  status: CallStatus;
  transcript: TranscriptLine[];
}

export const mockAgents: Agent[] = [
  { id: 'a1', name: 'Meredith', status: 'Online' },
];

function tx(lines: [string, 'Agent' | 'Caller', string][]): TranscriptLine[] {
  return lines.map(([timestamp, speaker, text]) => ({ timestamp, speaker, text }));
}

export const mockCallLogs: CallLog[] = [
  {
    id: 'c001', agentId: 'a1', createdAt: '2026-02-18T09:12:00Z', durationSec: 187,
    callerPhone: '***-***-0192', patientName: 'James Whitfield', age: 67, sex: 'M', zipCode: '30301',
    triageLevel: 'HIGH', reasonShort: 'Chest pain + shortness of breath',
    chiefComplaint: 'Sudden onset chest tightness radiating to left arm with difficulty breathing.',
    symptoms: ['chest pain', 'dyspnea', 'left arm numbness', 'diaphoresis'],
    riskFlags: ['cardiac history', 'age >65', 'acute onset'],
    summary: 'Male, 67, reports sudden chest tightness radiating to left arm with shortness of breath. History of hypertension. Onset ~20 minutes before calling. Sweating and anxious.',
    recommendation: 'Immediate escalation to cardiology or ER dispatch. Advise caller to chew aspirin if not allergic.',
    status: 'Escalated',
    transcript: tx([
      ['0:00', 'Agent', 'Thank you for calling Meredith Health Line. How can I help you today?'],
      ['0:04', 'Caller', 'I\'m having really bad chest pain, it\'s tight and going down my left arm.'],
      ['0:10', 'Agent', 'I\'m sorry to hear that. How long ago did this start?'],
      ['0:14', 'Caller', 'Maybe 20 minutes ago. I\'m sweating a lot too.'],
      ['0:19', 'Agent', 'Do you have any history of heart problems or high blood pressure?'],
      ['0:24', 'Caller', 'Yeah, I take blood pressure medicine.'],
      ['0:28', 'Agent', 'Are you allergic to aspirin?'],
      ['0:31', 'Caller', 'No.'],
      ['0:33', 'Agent', 'Please chew one regular aspirin now if you have it available. I\'m flagging this as urgent.'],
      ['0:40', 'Caller', 'Okay, thank you.'],
      ['0:43', 'Agent', 'Stay on the line. I\'m connecting you to emergency services. Help is on the way.'],
      ['0:48', 'Caller', 'Thank you so much.'],
    ]),
  },
  {
    id: 'c002', agentId: 'a1', createdAt: '2026-02-18T08:45:00Z', durationSec: 134,
    callerPhone: '***-***-7731', patientName: 'Sarah Chen', age: 34, sex: 'F', zipCode: '30305',
    triageLevel: 'LOW', reasonShort: 'Prescription refill request',
    chiefComplaint: 'Needs refill on birth control prescription, pharmacy says authorization expired.',
    symptoms: [], riskFlags: [],
    summary: 'Female, 34, calling for prescription refill on oral contraceptive. Pharmacy flagged expired authorization. No acute symptoms.',
    recommendation: 'Route to pharmacy support for refill authorization. Non-urgent.',
    status: 'Resolved',
    transcript: tx([
      ['0:00', 'Agent', 'Thank you for calling. How can I help?'],
      ['0:03', 'Caller', 'Hi, I need a refill on my birth control but the pharmacy says the authorization expired.'],
      ['0:09', 'Agent', 'I can help with that. Can you confirm the medication name?'],
      ['0:13', 'Caller', 'It\'s Yaz, I\'ve been on it for two years.'],
      ['0:17', 'Agent', 'Got it. I\'m routing this to pharmacy support for a refill authorization. You should hear back within 24 hours.'],
      ['0:25', 'Caller', 'Great, thanks!'],
    ]),
  },
  {
    id: 'c003', agentId: 'a1', createdAt: '2026-02-18T07:30:00Z', durationSec: 246,
    callerPhone: '***-***-4419', patientName: 'Robert Keane', age: 72, sex: 'M', zipCode: '30301',
    triageLevel: 'HIGH', reasonShort: 'Severe dizziness + confusion',
    chiefComplaint: 'Sudden dizziness, slurred speech, and confusion reported by spouse.',
    symptoms: ['dizziness', 'slurred speech', 'confusion', 'unsteady gait'],
    riskFlags: ['stroke indicators', 'age >65', 'sudden onset', 'diabetes'],
    summary: 'Spouse called for 72-year-old male experiencing sudden dizziness, slurred speech, and confusion. Diabetic, on metformin. Symptoms started 15 minutes ago.',
    recommendation: 'Immediate stroke protocol. Dispatch EMS. Advise caller to note symptom onset time.',
    status: 'Escalated',
    transcript: tx([
      ['0:00', 'Agent', 'Meredith Health Line, how can I assist you?'],
      ['0:03', 'Caller', 'My husband is acting strange, he\'s dizzy and his words are coming out wrong.'],
      ['0:09', 'Agent', 'When did this start?'],
      ['0:11', 'Caller', 'About 15 minutes ago, he was fine before that.'],
      ['0:16', 'Agent', 'Can he raise both arms above his head?'],
      ['0:20', 'Caller', 'He\'s trying but his left arm keeps dropping.'],
      ['0:24', 'Agent', 'This could be a stroke. I\'m dispatching emergency services now. Please note the time symptoms began.'],
      ['0:32', 'Caller', 'Oh my god, okay.'],
      ['0:35', 'Agent', 'Stay calm. Help is on the way. Keep him seated and don\'t give him anything to eat or drink.'],
    ]),
  },
  {
    id: 'c004', agentId: 'a1', createdAt: '2026-02-18T09:00:00Z', durationSec: 98,
    callerPhone: '***-***-5582', patientName: 'Lisa Park', age: 28, sex: 'F', zipCode: '30308',
    triageLevel: 'MED', reasonShort: 'Persistent migraine 3 days',
    chiefComplaint: 'Migraine headache lasting 3 days, not responding to OTC medication.',
    symptoms: ['severe headache', 'photophobia', 'nausea', 'visual aura'],
    riskFlags: ['duration >48h', 'visual disturbance'],
    summary: 'Female, 28, reports a migraine lasting 3 days with aura, light sensitivity, and nausea. Ibuprofen and acetaminophen ineffective. No fever, no neck stiffness.',
    recommendation: 'Schedule same-day neurology or urgent care visit. Prescribe triptan if appropriate.',
    status: 'Needs review',
    transcript: tx([
      ['0:00', 'Agent', 'How can I help you today?'],
      ['0:03', 'Caller', 'I\'ve had this terrible migraine for three days and nothing is helping.'],
      ['0:08', 'Agent', 'What have you tried so far?'],
      ['0:10', 'Caller', 'Ibuprofen, Tylenol, rest, dark room. Nothing works.'],
      ['0:15', 'Agent', 'Any visual changes, fever, or neck stiffness?'],
      ['0:19', 'Caller', 'I see these zigzag lines sometimes and light makes it worse.'],
      ['0:25', 'Agent', 'I\'m going to recommend a same-day visit. Let me check availability.'],
    ]),
  },
  {
    id: 'c005', agentId: 'a1', createdAt: '2026-02-18T08:20:00Z', durationSec: 156,
    callerPhone: '***-***-3308', age: 45, sex: 'M', zipCode: '30312',
    triageLevel: 'MED', reasonShort: 'Blood in urine, no pain',
    chiefComplaint: 'Noticed blood in urine this morning. No pain or burning.',
    symptoms: ['hematuria', 'no dysuria'],
    riskFlags: ['painless hematuria', 'age >40', 'smoker'],
    summary: 'Male, 45, smoker, reports painless gross hematuria noticed this morning. No burning, no flank pain. No prior history of kidney stones.',
    recommendation: 'Schedule urology consult within 48 hours. Urinalysis and imaging recommended.',
    status: 'Needs review',
    transcript: tx([
      ['0:00', 'Agent', 'Meredith Health Line. What brings you in today?'],
      ['0:04', 'Caller', 'I noticed blood in my urine this morning. It freaked me out.'],
      ['0:09', 'Agent', 'Any pain or burning when you urinate?'],
      ['0:12', 'Caller', 'No, it doesn\'t hurt at all.'],
      ['0:15', 'Agent', 'Any back or side pain?'],
      ['0:17', 'Caller', 'Nope.'],
      ['0:19', 'Agent', 'Do you smoke?'],
      ['0:21', 'Caller', 'Yeah, about a pack a day.'],
      ['0:25', 'Agent', 'I\'d recommend seeing a urologist soon. I\'ll set up a referral.'],
    ]),
  },
  {
    id: 'c006', agentId: 'a1', createdAt: '2026-02-18T07:55:00Z', durationSec: 78,
    callerPhone: '***-***-6641', patientName: 'Emma Wilson', age: 5, sex: 'F', zipCode: '30301',
    triageLevel: 'MED', reasonShort: 'Child fever 103°F + rash',
    chiefComplaint: 'Parent reports 5-year-old with 103°F fever and spreading rash on torso.',
    symptoms: ['high fever', 'maculopapular rash', 'irritability', 'decreased appetite'],
    riskFlags: ['pediatric', 'high fever', 'rash'],
    summary: 'Parent calling for 5-year-old daughter with 103°F fever since last night and a red, blotchy rash spreading on her torso. Child is irritable but alert.',
    recommendation: 'Same-day pediatric evaluation recommended. Monitor for signs of meningitis (neck stiffness, lethargy).',
    status: 'Resolved',
    transcript: tx([
      ['0:00', 'Agent', 'How can I help?'],
      ['0:02', 'Caller', 'My daughter has a really high fever and she\'s getting this rash all over.'],
      ['0:07', 'Agent', 'How high is the fever?'],
      ['0:09', 'Caller', '103. I gave her Tylenol an hour ago.'],
      ['0:13', 'Agent', 'Is she alert and responsive?'],
      ['0:15', 'Caller', 'Yes, just cranky and not eating.'],
      ['0:19', 'Agent', 'I\'d like her seen today. Let me book a pediatric appointment.'],
    ]),
  },
  {
    id: 'c007', agentId: 'a1', createdAt: '2026-02-18T09:05:00Z', durationSec: 212,
    callerPhone: '***-***-9903', patientName: 'David Morales', age: 55, sex: 'M', zipCode: '30305',
    triageLevel: 'HIGH', reasonShort: 'Difficulty breathing + wheezing',
    chiefComplaint: 'Worsening shortness of breath over 2 hours, audible wheezing, history of COPD.',
    symptoms: ['dyspnea', 'wheezing', 'tachypnea', 'chest tightness'],
    riskFlags: ['COPD exacerbation', 'respiratory distress', 'age >50'],
    summary: 'Male, 55, with COPD reports worsening shortness of breath and wheezing over 2 hours. Rescue inhaler providing minimal relief. Speaking in short sentences.',
    recommendation: 'Urgent evaluation needed. Consider ER if inhaler not effective. May need nebulizer treatment and steroids.',
    status: 'Escalated',
    transcript: tx([
      ['0:00', 'Agent', 'Thank you for calling. How can I help?'],
      ['0:03', 'Caller', 'I can\'t... breathe well. My inhaler... isn\'t helping.'],
      ['0:09', 'Agent', 'I can hear you\'re having difficulty. Do you have COPD or asthma?'],
      ['0:14', 'Caller', 'COPD... diagnosed... five years ago.'],
      ['0:19', 'Agent', 'How many times have you used your rescue inhaler today?'],
      ['0:23', 'Caller', 'Four... times... in two hours.'],
      ['0:28', 'Agent', 'That\'s concerning. I\'m going to recommend you go to the ER. Can someone drive you?'],
      ['0:35', 'Caller', 'My wife... can drive.'],
      ['0:38', 'Agent', 'Good. Go now. If breathing gets worse, call 911 immediately.'],
    ]),
  },
  {
    id: 'c008', agentId: 'a1', createdAt: '2026-02-18T08:30:00Z', durationSec: 110,
    callerPhone: '***-***-2257', patientName: 'Nancy Liu', age: 41, sex: 'F', zipCode: '30309',
    triageLevel: 'LOW', reasonShort: 'Lab results inquiry',
    chiefComplaint: 'Wants to discuss blood test results from last week.',
    symptoms: [], riskFlags: [],
    summary: 'Female, 41, calling to review lab results from annual physical. No acute concerns. Results show mildly elevated cholesterol.',
    recommendation: 'Schedule follow-up with PCP for cholesterol management discussion. Non-urgent.',
    status: 'Resolved',
    transcript: tx([
      ['0:00', 'Agent', 'How can I help you today?'],
      ['0:03', 'Caller', 'I got blood work done last week and I want to know my results.'],
      ['0:08', 'Agent', 'I can see your results here. Your cholesterol is slightly elevated at 218.'],
      ['0:15', 'Caller', 'Is that bad?'],
      ['0:17', 'Agent', 'It\'s borderline. I\'d recommend scheduling a follow-up with your doctor to discuss lifestyle changes.'],
      ['0:25', 'Caller', 'Okay, can you set that up?'],
      ['0:28', 'Agent', 'Absolutely. I\'ll send you a scheduling link.'],
    ]),
  },
  {
    id: 'c009', agentId: 'a1', createdAt: '2026-02-18T07:15:00Z', durationSec: 340,
    callerPhone: '***-***-8814', patientName: 'Thomas Grant', age: 80, sex: 'M', zipCode: '30301',
    triageLevel: 'HIGH', reasonShort: 'Fall with head injury',
    chiefComplaint: 'Elderly patient fell, hit head on counter. Small laceration, confused.',
    symptoms: ['head laceration', 'confusion', 'dizziness', 'nausea'],
    riskFlags: ['head trauma', 'age >65', 'on blood thinners', 'confusion'],
    summary: 'Male, 80, on warfarin, fell at home and struck head on kitchen counter. Has a 2cm laceration above right eyebrow. Currently confused and nauseated.',
    recommendation: 'Immediate ER evaluation. Head CT required given anticoagulant use and altered mental status. Do not let patient sleep.',
    status: 'Escalated',
    transcript: tx([
      ['0:00', 'Agent', 'Meredith Health Line.'],
      ['0:02', 'Caller', 'My father just fell and hit his head. There\'s blood.'],
      ['0:07', 'Agent', 'Is he conscious?'],
      ['0:09', 'Caller', 'Yes but he seems confused. He\'s not making sense.'],
      ['0:14', 'Agent', 'Is he on any blood thinners?'],
      ['0:17', 'Caller', 'Yes, warfarin.'],
      ['0:20', 'Agent', 'This needs immediate attention. Apply gentle pressure to the wound. I\'m dispatching an ambulance now.'],
      ['0:28', 'Caller', 'Should I let him lie down?'],
      ['0:31', 'Agent', 'Keep him seated upright if possible. Don\'t let him fall asleep. Help is on the way.'],
    ]),
  },
  {
    id: 'c010', agentId: 'a1', createdAt: '2026-02-18T09:10:00Z', durationSec: 92,
    callerPhone: '***-***-1147', patientName: 'Karen Mitchell', age: 38, sex: 'F', zipCode: '30312',
    triageLevel: 'LOW', reasonShort: 'Appointment reschedule',
    chiefComplaint: 'Needs to reschedule dermatology appointment.',
    symptoms: [], riskFlags: [],
    summary: 'Female, 38, requesting reschedule of dermatology follow-up originally set for Feb 20. No acute concerns.',
    recommendation: 'Reschedule per patient preference. Non-urgent follow-up.',
    status: 'Resolved',
    transcript: tx([
      ['0:00', 'Agent', 'How can I help you today?'],
      ['0:03', 'Caller', 'I need to reschedule my derm appointment for next Friday.'],
      ['0:07', 'Agent', 'Sure. What works better for you?'],
      ['0:10', 'Caller', 'Anything the following week.'],
      ['0:13', 'Agent', 'I have Tuesday the 24th at 2pm. Does that work?'],
      ['0:18', 'Caller', 'Perfect, thank you.'],
    ]),
  },
  {
    id: 'c011', agentId: 'a1', createdAt: '2026-02-18T08:50:00Z', durationSec: 178,
    callerPhone: '***-***-4490', patientName: 'Michael Torres', age: 52, sex: 'M', zipCode: '30305',
    triageLevel: 'MED', reasonShort: 'Abdominal pain + nausea 2 days',
    chiefComplaint: 'Persistent right lower abdominal pain with nausea for 2 days.',
    symptoms: ['RLQ pain', 'nausea', 'low-grade fever', 'loss of appetite'],
    riskFlags: ['appendicitis differential', 'progressive pain'],
    summary: 'Male, 52, reports 2 days of worsening right lower quadrant abdominal pain with nausea, low-grade fever (100.2°F), and appetite loss. Pain worse with movement.',
    recommendation: 'Urgent evaluation for possible appendicitis. ER visit recommended for imaging.',
    status: 'Needs review',
    transcript: tx([
      ['0:00', 'Agent', 'How can I help you?'],
      ['0:02', 'Caller', 'I\'ve had this pain in my lower right side for two days and it\'s getting worse.'],
      ['0:08', 'Agent', 'On a scale of 1-10, how would you rate it?'],
      ['0:11', 'Caller', 'It was a 4 yesterday, now it\'s like a 7.'],
      ['0:15', 'Agent', 'Any fever, nausea, or vomiting?'],
      ['0:18', 'Caller', 'Slight fever and I feel nauseous but haven\'t thrown up.'],
      ['0:24', 'Agent', 'This could be appendicitis. I strongly recommend going to the ER for evaluation.'],
    ]),
  },
  {
    id: 'c012', agentId: 'a1', createdAt: '2026-02-18T08:10:00Z', durationSec: 65,
    callerPhone: '***-***-7723', zipCode: '30308', triageLevel: 'LOW',
    reasonShort: 'Insurance coverage question',
    chiefComplaint: 'Asking whether MRI is covered under current plan.',
    symptoms: [], riskFlags: [],
    summary: 'Caller inquiring about insurance coverage for an upcoming MRI. No clinical concerns.',
    recommendation: 'Transfer to billing/insurance department.',
    status: 'Resolved',
    transcript: tx([
      ['0:00', 'Agent', 'How may I assist you?'],
      ['0:03', 'Caller', 'I need to know if my insurance covers an MRI.'],
      ['0:07', 'Agent', 'I can transfer you to our billing department for that. One moment.'],
    ]),
  },

];

/* ── Mock live calls toggle ─────────────────────────── */
// Flip to false to hide mock live calls (e.g. when testing real calls)
export const SHOW_MOCK_LIVE_CALLS = false;

const mockLiveCalls: CallLog[] = [
  {
    id: 'live-001', agentId: 'a1', createdAt: '2026-02-20T20:23:00Z', durationSec: 0,
    callerPhone: '***-***-9134', patientName: 'Edward Marsh', age: 73, sex: 'M', zipCode: '30301',
    triageLevel: 'HIGH', reasonShort: 'Chest tightness + jaw pain',
    chiefComplaint: 'Tightness in chest radiating to jaw, started 10 minutes ago.',
    symptoms: ['chest tightness', 'jaw pain', 'diaphoresis'],
    riskFlags: ['cardiac event', 'age >65', 'acute onset'],
    summary: 'Call in progress — AI triage ongoing.',
    recommendation: '',
    status: 'Live',
    transcript: tx([
      ['0:00', 'Agent', 'Thank you for calling Meredith Health Line. How can I help?'],
      ['0:04', 'Caller', 'I have this tightness in my chest and my jaw hurts.'],
      ['0:09', 'Agent', 'When did this start?'],
      ['0:11', 'Caller', 'About 10 minutes ago. I\'m sweating too.'],
      ['0:16', 'Agent', 'Do you have any history of heart problems?'],
      ['0:20', 'Caller', 'I had a stent put in three years ago.'],
      ['0:25', 'Agent', 'Are you taking aspirin or any blood thinners?'],
    ]),
  },
];

export function getMockLiveCalls(): CallLog[] {
  return SHOW_MOCK_LIVE_CALLS ? mockLiveCalls : [];
}

/* ── Workers (human operators who oversee agents) ──── */

export interface Worker {
  id: string;
  name: string;
  role: string;
  initials: string;
  agentIds: string[];
}

export const mockWorkers: Worker[] = [
  { id: 'w1', name: 'Arhaan K.', role: 'Lead Triage Nurse', initials: 'NK', agentIds: ['a1'] },
];

/* ── Helpers ────────────────────────────────────────── */

export function getAgentQueueCount(agentId: string): number {
  return mockCallLogs.filter(
    (c) => c.agentId === agentId && c.status === 'Needs review',
  ).length;
}

export function getCallById(id: string): CallLog | undefined {
  return mockCallLogs.find((c) => c.id === id);
}

export function getCallsForAgent(agentId: string): CallLog[] {
  return mockCallLogs
    .filter((c) => c.agentId === agentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAgentsForWorker(workerId: string): Agent[] {
  const worker = mockWorkers.find((w) => w.id === workerId);
  if (!worker) return mockAgents;
  return mockAgents.filter((a) => worker.agentIds.includes(a.id));
}

export function getCallsForWorker(workerId: string): CallLog[] {
  const worker = mockWorkers.find((w) => w.id === workerId);
  if (!worker) return mockCallLogs;
  return mockCallLogs
    .filter((c) => worker.agentIds.includes(c.agentId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
