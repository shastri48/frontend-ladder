import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout'
import Home from './pages/Home'
import LevelPage, { LearnIndex } from './pages/Level'
import LessonPage from './pages/Lesson'
import Practice from './pages/Practice'
import Flashcards from './pages/Flashcards'
import PlaygroundPage from './pages/PlaygroundPage'
import ProgressPage from './pages/ProgressPage'
import NotFound from './pages/NotFound'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/learn', element: <LearnIndex /> },
      { path: '/learn/:level', element: <LevelPage /> },
      { path: '/learn/:level/:module', element: <LessonPage /> },
      { path: '/learn/:level/:module/:lesson', element: <LessonPage /> },
      { path: '/practice', element: <Practice /> },
      { path: '/flashcards', element: <Flashcards /> },
      { path: '/playground', element: <PlaygroundPage /> },
      { path: '/progress', element: <ProgressPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
