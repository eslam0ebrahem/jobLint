import { useEffect, useState } from 'react';
import { sendGatewayRequest } from '@/src/lib/gateway';
import type { ApplicationDossier, DossierStatus } from '@/src/types/dossier';
import type { RequirementEvidence } from '@/src/types/claims';

const STATUS_TONE: Record<DossierStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-slate-200 text-slate-700',
};

const COVERAGE_TONE: Record<RequirementEvidence['status'], string> = {
  covered: 'bg-emerald-100 text-emerald-800',
  partial: 'bg-amber-100 text-amber-800',
  gap: 'bg-rose-100 text-rose-800',
  unknown: 'bg-slate-100 text-slate-500',
};

interface Props {
  jobId: string;
  onError: (message: string) => void;
}

export function DossierPanel({ jobId, onError }: Props) {
  const [dossiers, setDossiers] = useState<ApplicationDossier[]>([]);
  const [requirements, setRequirements] = useState<RequirementEvidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [answerQuestion, setAnswerQuestion] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [artifactLabel, setArtifactLabel] = useState('Résumé');
  const [artifactReference, setArtifactReference] = useState('');

  const current = dossiers[0] || null;

  const load = async () => {
    try {
      const [records, coverage] = await Promise.all([
        sendGatewayRequest({ action: 'list-dossiers', jobId }),
        sendGatewayRequest({ action: 'get-job-requirements', id: jobId }),
      ]);
      setDossiers(records);
      setRequirements(coverage);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not load the application record.');
    }
  };

  useEffect(() => {
    void load();
    setAnswerQuestion('');
    setAnswerText('');
  }, [jobId]);

  const run = async (action: () => Promise<ApplicationDossier>) => {
    setBusy(true);
    try {
      const saved = await action();
      setDossiers((existing) => [saved, ...existing.filter((item) => item.id !== saved.id)]);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not update the application record.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Application record</h3>
      {current && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[current.status]}`}>{current.status}</span>}
    </div>

    {requirements.length > 0 && <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Claim coverage of detected requirements</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {requirements.map((item) => <span key={item.requirement} title={item.detail} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${COVERAGE_TONE[item.status]}`}>{item.status === 'covered' ? '✓' : item.status === 'partial' ? '~' : '×'} {item.requirement}</span>)}
      </div>
      {requirements.some((item) => item.status === 'gap') && <p className="mt-1.5 text-[10px] text-slate-500">A × requirement has no claim behind it. The packet will not assert it.</p>}
    </div>}

    {!current ? <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
      No application record yet. Opening one captures an immutable snapshot of this posting, the evaluator version, and the claims behind your packet.
      <button type="button" onClick={() => void run(() => sendGatewayRequest({ action: 'open-dossier', id: jobId }))} disabled={busy} className="mt-2 cursor-pointer rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[10px] font-bold text-indigo-700 disabled:opacity-50">{busy ? 'Opening…' : 'Open application record'}</button>
    </div> : <>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-slate-50 p-2.5 text-[10px] text-slate-600">
        <div><dt className="inline font-bold">Captured </dt><dd className="inline">{new Date(current.posting.capturedAt).toLocaleString()}</dd></div>
        <div><dt className="inline font-bold">Content </dt><dd className="inline font-mono">{current.posting.contentHash}</dd></div>
        <div><dt className="inline font-bold">Detector </dt><dd className="inline">{current.posting.detector.source} · {current.posting.detector.strategy}</dd></div>
        <div><dt className="inline font-bold">Packet </dt><dd className="inline">v{current.packet.packetVersion} · {current.packet.claimIds.length} claim(s)</dd></div>
        <div><dt className="inline font-bold">Evaluator </dt><dd className="inline">{current.evaluation ? `v${current.evaluation.evaluatorVersion} · ${current.evaluation.score}/5` : 'not captured'}</dd></div>
        <div><dt className="inline font-bold">Policy </dt><dd className="inline capitalize">{current.packet.policyLevel}</dd></div>
      </dl>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Answers given</p>
        {current.answers.length === 0 ? <p className="mt-1 text-[10px] text-slate-400">Nothing recorded yet.</p> : <ul className="mt-1 space-y-1">{current.answers.map((answer) => <li key={answer.id} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px]">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-800">{answer.question}</p>
            <button type="button" onClick={() => void run(() => sendGatewayRequest({ action: 'remove-dossier-answer', id: current.id, answerId: answer.id }))} aria-label={`Remove ${answer.question}`} className="cursor-pointer text-slate-400 hover:text-rose-600">×</button>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap text-slate-600">{answer.answer || <span className="italic text-slate-400">Empty</span>}</p>
          {answer.claimIds.length > 0 && <p className="mt-0.5 text-[10px] text-slate-400">Backed by {answer.claimIds.length} claim(s)</p>}
        </li>)}</ul>}
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          <input value={answerQuestion} onChange={(event) => setAnswerQuestion(event.target.value)} placeholder="Question" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] outline-none focus:border-indigo-500" />
          <input value={answerText} onChange={(event) => setAnswerText(event.target.value)} placeholder="Your answer" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] outline-none focus:border-indigo-500" />
        </div>
        <button type="button" onClick={() => void run(() => sendGatewayRequest({ action: 'save-dossier-answer', id: current.id, answer: { question: answerQuestion, answer: answerText } }))} disabled={busy || !answerQuestion.trim()} className="mt-1.5 cursor-pointer rounded-lg border border-indigo-200 px-2.5 py-1 text-[10px] font-bold text-indigo-700 disabled:opacity-50">Save answer</button>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Referenced artifacts</p>
        {current.artifacts.length === 0 ? <p className="mt-1 text-[10px] text-slate-400">No résumé, cover letter, or portfolio recorded.</p> : <ul className="mt-1 space-y-1">{current.artifacts.map((artifact) => <li key={artifact.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px]">
          <span className="min-w-0"><strong className="text-slate-800">{artifact.label}</strong> <span className="text-slate-500">({artifact.kind})</span><span className="block truncate text-[10px] text-slate-400">{artifact.reference}</span></span>
          <button type="button" onClick={() => void run(() => sendGatewayRequest({ action: 'remove-dossier-artifact', id: current.id, artifactId: artifact.id }))} aria-label={`Remove ${artifact.label}`} className="cursor-pointer text-slate-400 hover:text-rose-600">×</button>
        </li>)}</ul>}
        <div className="mt-2 grid gap-1.5 sm:grid-cols-[8rem_1fr]">
          <input value={artifactLabel} onChange={(event) => setArtifactLabel(event.target.value)} placeholder="Label" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] outline-none focus:border-indigo-500" />
          <input value={artifactReference} onChange={(event) => setArtifactReference(event.target.value)} placeholder="Local file name or URL (never uploaded)" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] outline-none focus:border-indigo-500" />
        </div>
        <button type="button" onClick={() => void run(() => sendGatewayRequest({ action: 'save-dossier-artifact', id: current.id, artifact: { kind: 'resume', label: artifactLabel, reference: artifactReference, claimIds: current.packet.claimIds } }))} disabled={busy || !artifactLabel.trim() || !artifactReference.trim()} className="mt-1.5 cursor-pointer rounded-lg border border-indigo-200 px-2.5 py-1 text-[10px] font-bold text-indigo-700 disabled:opacity-50">Attach reference</button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
        {current.status !== 'submitted' && <button type="button" onClick={() => void run(() => sendGatewayRequest({ action: 'set-dossier-status', id: current.id, status: 'submitted' }))} disabled={busy} className="cursor-pointer rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-50">Mark as submitted</button>}
        {current.status === 'submitted' && <button type="button" onClick={() => void run(() => sendGatewayRequest({ action: 'set-dossier-status', id: current.id, status: 'closed' }))} disabled={busy} className="cursor-pointer rounded-lg border border-slate-300 px-2.5 py-1 text-[10px] font-bold text-slate-700 disabled:opacity-50">Close record</button>}
        {current.submittedAt && <span className="text-[10px] text-slate-400">Submitted {new Date(current.submittedAt).toLocaleString()}</span>}
        <span className="ml-auto text-[10px] text-slate-400">{current.eventIds.length} linked event(s)</span>
      </div>
    </>}
  </section>;
}
