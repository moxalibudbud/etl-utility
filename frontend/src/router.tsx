import { createBrowserRouter } from 'react-router'
import Home from '@/pages/Home'
import TransformFile from '@/pages/TransformFile'
import OctoplusPortalHome from './pages/OctoplusPortalHome'
import ConfigBuilder from '@/pages/ConfigBuilder'
import ConfigList from '@/pages/ConfigList'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/transform/:repo',
    element: <TransformFile />,
  },
  {
    path: '/octoplus',
    element: <OctoplusPortalHome />,
  },
  {
    path: '/configs',
    element: <ConfigList />,
  },
  {
    path: '/config-builder',
    element: <ConfigBuilder />,
  },
])
