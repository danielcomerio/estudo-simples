import { ImportZone } from '@/components/ImportZone';
import { BancoList } from '@/components/BancoList';
import { BackToTop } from '@/components/BackToTop';
import { BancoPullRefresh } from '@/components/BancoPullRefresh';

export default function BancoPage() {
  return (
    <BancoPullRefresh>
      <ImportZone />
      <BancoList />
      <BackToTop />
    </BancoPullRefresh>
  );
}
