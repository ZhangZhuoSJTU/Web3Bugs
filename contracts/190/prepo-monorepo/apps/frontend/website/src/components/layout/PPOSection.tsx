import { FC } from 'react'
import { CurvedCarousel, CurvedCarouselItemData } from '../carousel'
import { Icon } from '../Icon'
import { Intro, IntroContainer } from '../intro'
import NonBreakingText from '../NonBreakingText'
import SectionTitle from '../SectionTitle'

const items: CurvedCarouselItemData[] = [
  {
    id: 'spend',
    title: 'Spend',
    icon: 'spend',
    content: 'Spend PPO on reward boosts, avatar items, merch, and more!',
  },
  {
    id: 'earn',
    title: 'Earn',
    icon: 'earn',
    content:
      'Earn PPO by being an active user on the prePO platform, by participating in governance, and through staking.',
  },
  {
    id: 'stake',
    title: 'Stake',
    icon: 'timelock',
    content:
      'Stake PPO for an extended period of time - the longer you stake for, the greater your future distributions and voting power.',
  },
]

export const PPOSection: FC = () => (
  <section className="py-11">
    <IntroContainer>
      <div className="container px-10 mx-auto text-center">
        <SectionTitle className="mb-2 leading-[130.3%] sm:mb-3 md:mb-4">
          Powered by{' '}
          <Icon
            name="ppo"
            className="inline-block -mr-1 mb-1 ml-1 w-5 h-5 sm:w-7 sm:h-7 lg:mb-2 lg:w-10 lg:h-10"
          />
          <span className="text-prepo"> PPO</span>
        </SectionTitle>
      </div>
      <Intro type="fadeInUp">
        <p className="container px-10 pb-12 mx-auto text-sm font-medium text-center sm:text-base">
          PPO is the governance and utility token of the prePO platform.
          <br className="hidden sm:inline" /> Our tokenomics design incentivizes high quality,
          active participation and <NonBreakingText>long-term</NonBreakingText> alignment.
        </p>
        <CurvedCarousel items={items} />
      </Intro>
    </IntroContainer>
  </section>
)
