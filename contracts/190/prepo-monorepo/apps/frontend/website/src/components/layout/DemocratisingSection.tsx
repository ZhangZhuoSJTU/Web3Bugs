import { FC } from 'react'
import { Icon, IconName } from '../Icon'
import { Intro, IntroContainer } from '../intro'
import NonBreakingText from '../NonBreakingText'
import SectionTitle from '../SectionTitle'

type DemocratisingCardProps = {
  icon: IconName
  title: string
  description: React.ReactNode
}

const cards: DemocratisingCardProps[] = [
  {
    icon: 'people',
    title: 'Anyone',
    description:
      'prePO brings fairness to the private markets by enabling equal opportunity for all, regardless of wealth, connections, location, or socioeconomic background.',
  },
  {
    icon: 'assets',
    title: 'Anything',
    description: (
      <span>
        prePO facilitates decentralized synthetic markets for{' '}
        <NonBreakingText>pre-public</NonBreakingText> assets, allowing users to trade on their
        conviction, whilst providing <NonBreakingText>real-time</NonBreakingText> price discovery as
        a public good.
      </span>
    ),
  },
  {
    icon: 'anytime',
    title: 'Anytime',
    description:
      'No more worrying about timezones, weekends, or vesting periods - on prePO you can trade 24/7 without any lockups.',
  },
]

const DeomocratisingCard: FC<DemocratisingCardProps> = ({ icon, title, description }) => (
  <div className="flex flex-col justify-start items-center py-3 px-6 space-y-3 w-72 rounded-md border lg:items-start lg:py-6 lg:px-6 lg:w-64 border-prepo/[6%]">
    <div className="w-8 h-8 lg:w-12 lg:h-12">
      <Icon name={icon} width="100%" height="100%" />
    </div>
    <h2 className="text-lg font-bold text-title lg:text-[22px]">{title}</h2>
    <p className="text-xs lg:items-start lg:text-sm lg:text-left">{description}</p>
  </div>
)

export const DemocratisingSection: FC = () => (
  <div className="container relative px-10 pt-[45px] mx-auto text-center lg:pt-[120px]">
    <IntroContainer>
      <SectionTitle>
        <div className="lg:hidden">
          <span>Democratizing</span>
          <br />
          <NonBreakingText>Pre-Public</NonBreakingText> Investing
        </div>
        <div className="hidden lg:block">
          Democratizing <NonBreakingText>Pre-Public</NonBreakingText> Investing
        </div>
      </SectionTitle>
      <Intro type="fadeInUp">
        <p className="text-sm font-medium lg:text-base">
          We are transforming a world of financial exclusion into a world of permissionless access.
        </p>
        <div className="flex flex-wrap gap-4 justify-center items-stretch pb-10 mt-7 lg:gap-14 lg:pb-[95px] lg:mt-14">
          {cards.map(({ title, icon, description }) => (
            <DeomocratisingCard icon={icon} key={title} title={title} description={description} />
          ))}
        </div>
      </Intro>
    </IntroContainer>
  </div>
)
