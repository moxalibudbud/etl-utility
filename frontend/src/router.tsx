import { createBrowserRouter } from 'react-router'
import Home from '@/pages/Home'
import TransformFile from '@/pages/TransformFile'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/transform/:repo',
    element: <TransformFile />,
  },
])
