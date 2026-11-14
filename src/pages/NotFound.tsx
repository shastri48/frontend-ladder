import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="text-6xl font-black text-shimmer">404</div>
      <p className="mt-3 text-muted">This rung of the ladder doesn’t exist.</p>
      <Link to="/" className="mt-6 rounded-2xl bg-violet-600 px-5 py-2.5 font-semibold text-white">
        Back home
      </Link>
    </div>
  )
}
