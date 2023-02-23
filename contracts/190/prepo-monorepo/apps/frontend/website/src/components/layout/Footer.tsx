import ReCAPTCHA from 'react-google-recaptcha'
import { createRef, FC } from 'react'
import Head from 'next/head'
import { Button } from '../Button'
import { IconButton, IconButtonProps } from '../IconButton'
import { RECAPTCHA_SITE_ID, ROUTES } from '../../lib/constants'

const Nav: FC = ({ children }) => (
  <nav className="font-medium">
    <ul className="flex flex-col gap-12 my-10 sm:flex-row sm:gap-20 sm:justify-around lg:my-0">
      {children}
    </ul>
  </nav>
)

type NavGroupProps = { title: string }
const NavGroup: FC<NavGroupProps> = ({ title, children }) => (
  <li>
    <div className="text-base text-secondary sm:text-lg text-opacity-[62%]">{title}</div>
    <ul className="pt-4 space-y-[14px]">{children}</ul>
  </li>
)

type NavItemProps = { title: string; href: string }
const NavItem: FC<NavItemProps> = ({ title, href }) => (
  <li>
    <a
      href={href}
      target="_blank"
      className="text-sm hover:text-prepo-accent sm:text-base"
      rel="noreferrer"
    >
      {title}
    </a>
  </li>
)

const NewsletterSignup: FC = () => {
  const recaptchaRef = createRef<ReCAPTCHA>()

  return (
    <>
      {/* Must place ReCAPTCHA component where we want challenge to appear */}
      <Head>
        <link rel="preconnect" href="https://www.google.com" />
        <link rel="preconnect" href="https://www.gstatic.com" />
      </Head>
      <ReCAPTCHA ref={recaptchaRef} sitekey={RECAPTCHA_SITE_ID} size="invisible" />
      <div className="self-center w-[310px] max-w-full font-medium sm:w-[386px] lg:self-start">
        <div className="font-semibold sm:text-lg sm:leading-[23px]">Stay up to date</div>
        <p className="mt-[7px] mb-[16px] text-sm font-medium text-secondary text-opacity-[68%]">
          Get early access to our news &amp; releases
        </p>
        <Button
          className="py-2 px-4 pl-4 text-[11px] leading-none whitespace-nowrap rounded-sm sm:text-sm"
          href={ROUTES.NEWSLETTER}
          target="_blank"
          iconSize={14}
          iconClassName="ml-2"
        >
          Join Newsletter
        </Button>
      </div>
    </>
  )
}

const IconButtonSized: FC<IconButtonProps & { href: string }> = ({ href, ...props }) => (
  <a href={href} target="_blank" rel="noreferrer">
    {/* eslint-disable-next-line react/jsx-props-no-spreading */}
    <IconButton {...props} className="w-6 h-6 sm:w-12 sm:h-12" />
  </a>
)

const SocialLinks: FC = () => (
  <div className="flex flex-wrap gap-2 justify-center sm:gap-4">
    <IconButtonSized icon="twitter" aria-label="Twitter" href="https://twitter.com/prepo_io" />
    <IconButtonSized
      icon="discord"
      aria-label="Discord"
      href="https://url.prepo.io/discord-website-desktop"
    />
    <IconButtonSized icon="telegram" aria-label="Telegram" href={ROUTES.TELEGRAM} />
    <IconButtonSized
      icon="linkedIn"
      aria-label="LinkedIn"
      href="https://www.linkedin.com/company/prepo-io"
    />
    <IconButtonSized
      icon="instagram"
      aria-label="Instagram"
      href="https://www.instagram.com/prepo.io/"
    />
    <IconButtonSized icon="reddit" aria-label="Reddit" href="https://www.reddit.com/r/prepo_io/" />
    <IconButtonSized
      icon="facebook"
      aria-label="Facebook"
      href="https://www.facebook.com/prePO.official"
    />
    <IconButtonSized
      icon="youTube"
      aria-label="Youtube"
      href="https://www.youtube.com/channel/UCNcBzbUjN4GQevx4Z4dccVA"
    />
    <IconButtonSized icon="medium" aria-label="Medium" href={ROUTES.BLOG} />
    <IconButtonSized icon="github" aria-label="Github" href={ROUTES.GITHUB} />
  </div>
)

export const Footer: FC = () => (
  <div id="layout-footer" className="text-secondary bg-background-footer">
    <div className="container mx-auto max-w-[1180px] divide-y-2 divide-separator">
      <div className="flex flex-col p-7 sm:pt-14 sm:pb-10 lg:flex-row lg:gap-16 lg:justify-center xl:px-0">
        <div className="m-0 sm:m-auto lg:m-0">
          <img
            src="/prepo-logo.svg"
            alt="prePO logo"
            className="w-[102.5px]"
            width="685.71"
            height="230.25"
          />
        </div>
        <Nav>
          {/* <NavGroup title="PPO Token">
              <NavItem
                title="Staking"
                href="https://docs.prepo.io/tokenomics-and-governance#timelock"
              />
              <NavItem
                title="Governance"
                href="https://docs.prepo.io/tokenomics-and-governance#voting"
              />
              <NavItem
                title="Token Sale"
                href="https://docs.prepo.io/tokenomics-and-governance#ido"
              />
            </NavGroup> */}
          <NavGroup title="Resources">
            <NavItem title="Docs" href={ROUTES.DOCS} />
            <NavItem title="Blog" href={ROUTES.BLOG} />
            <NavItem title="Jobs" href={ROUTES.JOBS} />
          </NavGroup>
          <NavGroup title="Products">
            <NavItem title="PPO Sales" href={ROUTES.TOKEN_SALE} />
            <NavItem title="Testnet" href={ROUTES.APP} />
            <NavItem title="Simulator" href={ROUTES.SIMULATOR} />
          </NavGroup>
        </Nav>
        <NewsletterSignup />
      </div>
      <div className="flex flex-col flex-wrap gap-5 items-center p-5 text-sm text-center sm:py-12 lg:flex-row lg:justify-between xl:px-0">
        <div className="text-sm font-semibold text-secondary sm:text-lg text-opacity-60">
          &copy; prePO {new Date().getFullYear()}. All rights reserved.
        </div>
        <SocialLinks />
      </div>
    </div>
  </div>
)
