import { FC } from 'react'
import { FlatCarousel, FlatCarouselItemData } from '../carousel'
import { Intro, IntroContainer } from '../intro'
import SectionTitle from '../SectionTitle'

const items: FlatCarouselItemData[] = [
  {
    id: '2021H2',
    caption: 'H2 2021',
    icon: 'spanner',
    title: 'Build',
    content: (
      <>
        <span>Seed Round</span>
        <br />
        <span>Scaling Team & Community</span>
        <br />
        <span>SDK & Simulator</span>
        <br />
        <span>Website</span>
        <br />
        <span>Core Dapp (Internal Alpha)</span>
        <br />
        <span>Documentation</span>
      </>
    ),
  },
  {
    id: '2022H1',
    caption: 'H1 2022',
    icon: 'rocket-document',
    title: 'Pre-Launch',
    content: (
      <>
        <span>Strategic Round</span>
        <br />
        <span>Tokenomics</span>
        <br />
        <span>Core Dapp Audit</span>
        <br />
        <span>Testnet Launch</span>
      </>
    ),
  },
  {
    id: '2022H2',
    caption: 'H2 2022',
    icon: 'rocket',
    title: 'Launch',
    content: (
      <>
        <span>Token Audits</span>
        <br />
        <span>PPO Token Launch</span>
        <br />
        <span>Governance Launch</span>
        <br />
        <span>Platform Launch (Arbitrum)</span>
      </>
    ),
    current: true,
  },
  {
    id: '2023G',
    caption: '2023',
    icon: 'game',
    title: 'Gamify',
    content: (
      <>
        <span>Staking & Rewards</span>
        <br />
        <span>Achievements</span>
        <br />
        <span>Social Profiles</span>
        <br />
        <span>PPO Shop</span>
      </>
    ),
  },
  {
    id: '2023P',
    caption: '2023',
    icon: 'puzzle',
    title: 'Integrate',
    content: (
      <>
        <span>Fiat On-Ramps</span>
        <br />
        <span>Leverage</span>
        <br />
        <span>Insurance</span>
        <br />
        <span>DEX Aggregators</span>
        <br />
        <span>Zaps</span>
        <br />
        <span>Gnosis Safe App</span>
      </>
    ),
  },
  {
    id: 'Beyond',
    caption: 'Beyond',
    icon: 'telescope',
    title: 'Expand',
    content: (
      <>
        <span>prePO V2</span>
        <br />
        <span>prePO Pro</span>
        <br />
        <span>CEX & Broker Partnerships</span>
      </>
    ),
  },
]

export const RoadmapSection: FC = () => (
  <section className="container px-8 pt-[54px] pb-10 mx-auto max-w-[1440px] text-center sm:px-14 sm:pt-[78px] sm:pb-[92px]">
    <IntroContainer>
      <SectionTitle className="mb-9 font-semibold sm:mb-16">
        Building the future of private market access
      </SectionTitle>
      <Intro type="fadeInUp">
        <FlatCarousel items={items} />
      </Intro>
    </IntroContainer>
  </section>
)
