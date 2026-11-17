import { Component, type ReactNode } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { t } from '../lib/i18n';

interface State {
  error: Error | null;
}

/** Se uma tela quebrar, mostra uma mensagem com "tentar de novo" em vez de deixar a página travada. */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // mudou de página: limpa o erro
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error: Error) {
    console.error('[Shiori] tela quebrou:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <div className="font-jp text-6xl font-black text-pink/40">再読込</div>
        <h2 className="mt-2 font-display text-2xl">{t('Essa tela não carregou')}</h2>
        <p className="mt-2 text-sm text-muted">{t('Pode ter sido a internet ou uma atualização do site. Tente de novo.')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button className="manga-btn" onClick={() => this.setState({ error: null })}>
            <RotateCcw size={16} /> {t('Tentar de novo')}
          </button>
          <button className="manga-btn ghost" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> {t('Recarregar a página')}
          </button>
        </div>
      </div>
    );
  }
}
