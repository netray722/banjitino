import { fetchFifaImage } from '../../../_shared/fifa';

export const onRequestGet: PagesFunction<{ code: string }> = async ({ params }) => {
  const code = params.code.toUpperCase();

  if (!/^[A-Z]{3}$/.test(code)) {
    return Response.json({ error: 'Invalid FIFA country code' }, { status: 400 });
  }

  return fetchFifaImage(`picture/flags-sq-4/${code}`, 86_400);
};
