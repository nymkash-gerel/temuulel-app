import TrackingClient from './TrackingClient'

interface Props {
  params: Promise<{ deliveryNumber: string }>
}

export default async function TrackingPage({ params }: Props) {
  const { deliveryNumber } = await params

  return <TrackingClient deliveryNumber={deliveryNumber} />
}
