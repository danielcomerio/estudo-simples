import { ImportZone } from '@/components/ImportZone';
import { BancoList } from '@/components/BancoList';
import { BackToTop } from '@/components/BackToTop';
import { BancoPullRefresh } from '@/components/BancoPullRefresh';
import { AIPromptGenerator } from '@/components/AIPromptGenerator';

export default function BancoPage() {
  return (
    <BancoPullRefresh>
      <div style={{ marginBottom: 12 }}>
        <AIPromptGenerator />
      </div>
      <ImportZone />
      <BancoList />
      <BackToTop />
    </BancoPullRefresh>
  );
}
