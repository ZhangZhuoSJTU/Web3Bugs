import clsx from 'clsx'
import { FC } from 'react'
import { Footer } from './Footer'
import { Header } from './Header'

export const Layout: FC<{ isMobileMenuOpen: boolean; toggleMobileMenu: () => void }> = ({
  children,
  isMobileMenuOpen,
  toggleMobileMenu,
}) => (
  <>
    {/* Disable scrollbar when mobile menu is open: https://stackoverflow.com/a/27263789 */}
    <div
      id="layout"
      className={clsx(
        isMobileMenuOpen && 'overflow-hidden',
        'overflow-y-scroll min-h-screen max-h-screen lg:overflow-auto'
      )}
    >
      <Header isMobileMenuOpen={isMobileMenuOpen} toggleMobileMenu={toggleMobileMenu} />
      {children}
      <Footer />
    </div>
  </>
)
