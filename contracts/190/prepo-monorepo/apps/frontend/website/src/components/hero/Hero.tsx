import { FC } from 'react'
import dynamic from 'next/dynamic'
import NonBreakingText from '../NonBreakingText'
import { Button } from '../Button'
import { Icon } from '../Icon'
import { ROUTES } from '../../lib/constants'

// Lazy load as it's only esthetics, it's a 58KB module because of embedded PNGs.
const HeroAnimation = dynamic(() => import('./HeroAnimation/HeroAnimation'), {
  ssr: false,
})

export const Hero: FC = () => (
  <section className="relative">
    {/* Center animation, even below 1440px  */}
    <div className="overflow-x-hidden absolute top-0 left-0 z-[-1] w-full h-[619px] pointer-events-none">
      <div className="relative">
        <div className="absolute top-0 left-1/2 w-full max-w-[1440px] translate-x-[-720px]">
          <HeroAnimation />
        </div>
      </div>
    </div>
    {/* Main content */}
    <div className="pt-10 pb-[70px] animate-fadein-long sm:py-20 md:py-24 lg:py-[104px] lg:h-[619px]">
      <div className="container relative px-10 mx-auto space-y-4 max-w-[992px] text-center sm:space-y-5 md:space-y-6 lg:space-y-8">
        <h1 className="inline-block text-4xl font-bold leading-[45px] text-title sm:w-3/4 sm:text-5xl md:w-4/5 lg:w-full lg:text-[64px] lg:leading-[83px]">
          Speculate on <NonBreakingText className="text-prepo">pre-IPO</NonBreakingText> stocks
          &amp; <NonBreakingText className="text-prepo">pre-IDO</NonBreakingText> tokens
        </h1>
        <p className="inline-block text-sm font-medium leading-[151.3%] sm:w-3/4 md:w-1/2 md:text-base lg:w-[620px] lg:text-lg">
          prePO is a decentralized trading platform allowing anyone, anywhere to gain exposure to
          any <NonBreakingText>pre-public</NonBreakingText> asset.
        </p>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
          <Button
            href={ROUTES.TOKEN_SALE}
            target="_blank"
            className="w-[284px] relative overflow-hidden"
          >
            <Icon name="ppoGraphic" className="absolute z-0 left-0" />
            <span className="z-10">Buy PPO Token</span>
          </Button>
          <Button
            href={ROUTES.NEWSLETTER}
            target="_blank"
            buttonType="secondary"
            className="w-[284px]"
          >
            Join Newsletter
          </Button>
        </div>
      </div>
    </div>
  </section>
)
