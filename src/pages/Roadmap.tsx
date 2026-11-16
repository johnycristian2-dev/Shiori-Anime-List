import { SectionTitle } from '../components/ui';
import { ROADMAP, STATUS_LABEL } from '../lib/roadmap';

export default function Roadmap() {
  const all = ROADMAP.flatMap((p) => p.items);
  const done = all.filter((i) => i.status === 'feito').length;
  const pct = all.length ? (done / all.length) * 100 : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <SectionTitle title="Roadmap" jp="今後の予定" action={<span className="text-muted">{done}/{all.length} feitas</span>} />
      <p className="-mt-2 mb-4 text-sm font-bold text-muted">O que vem por aí no Shiori. Pendências organizadas por versão.</p>
      <div className="mb-10 h-4 overflow-hidden rounded-full border-2 border-black bg-panel-2">
        <div className="h-full bg-linear-to-r from-pink via-yellow to-cyan transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="relative space-y-10 border-l-[3px] border-dashed border-line pl-6 sm:pl-8">
        {ROADMAP.map((phase) => {
          const n = phase.items.filter((i) => i.status === 'feito').length;
          return (
            <section key={phase.version} className="relative">
              <span className="absolute -left-[38px] top-1 grid h-7 w-7 place-items-center rounded-full border-[3px] border-black bg-pink text-[10px] font-black text-white sm:-left-[46px]">
                {phase.version.slice(1)}
              </span>
              <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
                <h3 className="font-display text-xl">
                  {phase.version} · {phase.name}
                </h3>
                <span className="font-jp text-lg font-black text-pink">{phase.jp}</span>
                <span className="ml-auto text-xs font-black text-muted">
                  {n}/{phase.items.length}
                </span>
              </div>
              <p className="mb-4 text-sm text-muted">{phase.goal}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {phase.items.map((item) => {
                  const st = STATUS_LABEL[item.status];
                  return (
                    <div
                      key={item.id}
                      className={`panel flex gap-3 p-4 ${item.status === 'feito' ? 'opacity-60' : ''}`}
                      style={item.status === 'andamento' ? { borderColor: st.color, boxShadow: `4px 4px 0 ${st.color}` } : undefined}
                    >
                      <div className="text-2xl">{item.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className={`font-extrabold ${item.status === 'feito' ? 'line-through' : ''}`}>{item.title}</div>
                        <div className="mt-0.5 text-xs text-muted">{item.desc}</div>
                        <span className="mt-2 inline-block rounded-md border-2 border-black px-1.5 py-0.5 text-[10px] font-black uppercase text-black" style={{ background: st.color }}>
                          {st.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
