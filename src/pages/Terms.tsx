import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SectionTitle } from '../components/ui';
import { t } from '../lib/i18n';

const ITEMS = [
  {
    get h() {
      return t('O que é o Shiori');
    },
    get p() {
      return t('Um projeto pessoal e gratuito pra montar sua lista de animes. Os dados dos animes vêm do AniList.');
    },
  },
  {
    get h() {
      return t('O que guardamos');
    },
    get p() {
      return t('Com conta: e-mail, apelido, nome de exibição, bio, foto e banner, sua lista e sua data de nascimento. Sem conta, tudo fica só no seu navegador.');
    },
  },
  {
    get h() {
      return t('O que é público');
    },
    get p() {
      return t('Se o perfil estiver como Público: apelido, nome, foto, banner, bio, rank, conquistas e a lista (sem suas anotações). E-mail e data de nascimento nunca aparecem.');
    },
  },
  {
    get h() {
      return t('Idade mínima');
    },
    get p() {
      return t('É preciso ter pelo menos 13 anos para criar uma conta. A data de nascimento serve pra proteger menores de idade nos recursos de comunidade.');
    },
  },
  {
    get h() {
      return t('Regras de convivência');
    },
    get p() {
      return t('Nada de imagens ou textos ofensivos, sexuais, violentos ou de outras pessoas sem permissão. Contas que desrespeitarem podem ser removidas.');
    },
  },
  {
    get h() {
      return t('Seus direitos (LGPD)');
    },
    get p() {
      return t('Você pode ver, corrigir e excluir seus dados quando quiser em Editar perfil. Excluir a conta apaga tudo da nuvem.');
    },
  },
  {
    get h() {
      return t('Serviços usados');
    },
    get p() {
      return t('Supabase (contas e banco de dados), Vercel (hospedagem), AniList (dados dos animes) e tradução automática das sinopses. Nenhum dado seu é enviado para a tradução, só o texto da sinopse.');
    },
  },
  {
    get h() {
      return t('Shiori+ e doações');
    },
    get p() {
      return t('Pagamentos são feitos por Pix pelo Mercado Pago; o Shiori não vê nem guarda dados bancários. O Shiori+ é um pagamento único por período, sem renovação automática, e só libera extras visuais e sociais. Você pode pedir reembolso em até 7 dias na página Apoiar, e ele é automático. Doações não dão direito a nada além do selo de Apoiador.');
    },
  },
  {
    id: 'extensao',
    get h() {
      return t('Extensão Shiori Watch Party');
    },
    get p() {
      return t('A extensão só funciona nas páginas do Crunchyroll e do Shiori. Ela lê o nome do anime, o número do episódio e o estado do player (tocando, pausado, tempo) pra marcar o episódio na sua lista e sincronizar a watch party. Guarda no navegador a sua sessão do Shiori, suas opções e o código da sala. Envia ao Shiori só a atualização da lista, os comandos do player e as mensagens do chat da sala, e consulta o AniList pra achar o anime certo. Ela não lê seu histórico, outras abas, senhas de outros sites nem dados de pagamento, não mostra anúncios e não vende nem compartilha dados com ninguém.');
    },
  },
  {
    get h() {
      return t('Links de afiliado');
    },
    get p() {
      return t('Os botões da Amazon são links de afiliado: se você comprar por eles, o Shiori recebe uma pequena comissão, sem custo extra pra você.');
    },
  },
];

export default function Terms() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    const id = pathname === '/privacidade' ? 'extensao' : hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, [hash, pathname]);
  return (
    <div className="mx-auto max-w-3xl">
      <SectionTitle title={t('Termos e privacidade')} jp="規約" />
      <div className="panel space-y-5 p-6">
        {ITEMS.map((i) => (
          <div key={i.h} id={'id' in i ? i.id : undefined} className="scroll-mt-24">
            <h3 className="font-display text-lg">{i.h}</h3>
            <p className="mt-1 text-sm text-ink/85">{i.p}</p>
          </div>
        ))}
        <p className="border-t-2 border-dashed border-line pt-4 text-xs text-muted">{t('Última atualização: novembro de 2026.')}</p>
      </div>
      <Link to="/" className="manga-btn ghost mt-6">
        {t('Voltar')}
      </Link>
    </div>
  );
}
