import TeamView from './team-view';

export default async function SquadraPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <TeamView name={decodeURIComponent(name)} />;
}
