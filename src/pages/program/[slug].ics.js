import { talks, icsFor } from '../../lib/sessionize.js';

export function getStaticPaths() {
  return talks.map((session) => ({ params: { slug: session.slug }, props: { session } }));
}

export function GET({ props, site }) {
  const url = new URL(`/program/${props.session.slug}/`, site).href;
  return new Response(icsFor(props.session, url), { headers: { 'content-type': 'text/calendar; charset=utf-8' } });
}
