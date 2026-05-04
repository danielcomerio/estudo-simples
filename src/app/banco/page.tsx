import { ImportZone } from '@/components/ImportZone';
import { BancoList } from '@/components/BancoList';
import { BackToTop } from '@/components/BackToTop';

export default function BancoPage() {
  return (
    <>
      <ImportZone />
      <BancoList />
      <BackToTop />
    </>
  );
}
