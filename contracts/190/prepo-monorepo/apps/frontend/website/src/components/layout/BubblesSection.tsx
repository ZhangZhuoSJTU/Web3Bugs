import { useEffect, useState } from 'react'
import Lottie from 'react-lottie'
import { Icon, IconName } from '../Icon'
import SectionTitle from '../SectionTitle'
import animationData from '../lotties/Bubble.json'
import { Intro, IntroContainer, IntroTrail } from '../intro'
import NonBreakingText from '../NonBreakingText'
import { ONE_SECOND } from '../../lib/constants'

type BubbleProps = {
  description: string | JSX.Element
  iconName: IconName
  title: string
}

const bubbles: BubbleProps[] = [
  {
    iconName: 'doubleArrowUp',
    description: (
      <>
        <span>Want to be recognized for being an active user?</span>
        <br />
        <br />
        <span>Earn exp and level up to access exclusive opportunities.</span>
      </>
    ),
    title: `Level-Up`,
  },
  {
    iconName: 'trophey',
    description: (
      <>
        <span>Want to check off the basics, or prove your platform mastery?</span>
        <br />
        <br />
        <span>Unlock achievements to earn exp and exclusive NFTs.</span>
      </>
    ),
    title: `Achieve`,
  },
  {
    iconName: 'podium',
    description: (
      <>
        <span>Have a competitive spirit?</span>
        <br />
        <br />
        <span>
          Battle against your friends and the world, and claim your place at the top of the
          leaderboards.
        </span>
      </>
    ),
    title: `Compete`,
  },
  {
    iconName: 'peopleBox',
    description: (
      <>
        <span>
          Don&apos;t have the time or expertise to trade? Automatically replicate top traders and
          LPs.
        </span>
        <br />
        <br />
        <span>
          Confident in your abilities? Build up a following and earn{' '}
          <NonBreakingText>performance-based</NonBreakingText> rewards.
        </span>
      </>
    ),
    title: `Follow`,
  },
  {
    iconName: 'speechBubble',
    description: (
      <>
        <span>Want to share your market perspectives, or see what others are thinking?</span>
        <br />
        <br />
        <span>Engage in transparent discussions, filtering by level and market position.</span>
      </>
    ),
    title: `Discuss`,
  },
  {
    iconName: 'hatPerson',
    description: (
      <>
        <span>Want to showcase your prePO prowess?</span>
        <br />
        <br />
        <span>
          Build an <NonBreakingText>on-chain</NonBreakingText> reputation through your level,
          achievements, stats, PPO rank, and by customizing your avatar.
        </span>
      </>
    ),
    title: `Show Off`,
  },
]

const Bubble: React.FC<BubbleProps> = ({ description, iconName, title }) => {
  const [popped, setPopped] = useState(false)

  const defaultOptions = {
    loop: false,
    autoplay: true,
    animationData,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
    },
  }

  const handlePop = (): void => setPopped(true)

  useEffect(() => {
    if (popped) {
      setTimeout(() => {
        setPopped(false)
      }, ONE_SECOND * 15)
    }
  }, [popped])

  return (
    <div className="relative font-euclidA">
      <div className="pt-[100%] content-[' ']" />
      {/** content before pop */}
      <div
        className={`absolute top-0 left-0 w-full h-full duration-300 transform hover:scale-110 ${
          popped ? 'opacity-0 pointer-events-none' : 'cursor-pointer animate-bubble-popped'
        }`}
        onClick={handlePop}
        onKeyPress={handlePop}
        tabIndex={0}
        role="button"
      >
        <Icon className="w-full h-full" name="bubble" />
        <div className="flex absolute top-0 left-0 flex-col justify-center items-center w-full h-full">
          <Icon className="mb-4 w-12 text-white lg:mb-7" name={iconName} />
          <p className="text-2xl font-bold text-center text-white opacity-80">
            <NonBreakingText>{title.toUpperCase()}</NonBreakingText>
          </p>
        </div>
      </div>
      {/** content after pop */}
      <div className={`flex absolute top-0 left-0 w-full h-full ${popped ? 'flex' : 'hidden'}`}>
        {popped && <Lottie options={defaultOptions} height="100%" width="100%" />}
        <div className="flex absolute top-0 left-0 justify-center items-center p-5 w-full h-full text-secondary bg-prepo-light rounded-full animate-bubble-popped">
          <p className="p-3 text-sm text-center">{description}</p>
        </div>
      </div>
    </div>
  )
}

const BubbleSection: React.FC = () => (
  <IntroContainer maxScreenRatio={0.7}>
    <div className="container px-8 mx-auto mt-10 mb-16 max-w-5xl text-center lg:mb-[110px]">
      <SectionTitle>
        <div className="lg:hidden">
          <span>Making Trading Fun</span>
          <br />
          and Social
        </div>
        <div className="hidden lg:block">Making Trading Fun and Social</div>
      </SectionTitle>
      <Intro type="fadeInUp">
        <p className="text-sm font-normal leading-[18px] lg:text-2xl lg:leading-[30px]">
          pop the bubbles! ッ
        </p>
        <div className="flex justify-center items-center m-auto w-full max-w-[270px] h-full md:max-w-[600px] lg:max-w-screen-2xl">
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 mt-[52px] w-full h-full sm:max-w-md md:grid-cols-2 md:gap-x-10 md:gap-y-16 md:mt-[75px] md:max-w-5xl lg:grid-cols-3 lg:gap-x-16">
            <IntroTrail
              trailProps={{
                config: { mass: 5 },
                transform: 'scale(1)',
                from: { transform: 'scale(0.01)' },
              }}
              keys={bubbles.map(({ title }) => title)}
            >
              {bubbles.map(({ description, iconName, title }) => (
                <Bubble key={title} description={description} iconName={iconName} title={title} />
              ))}
            </IntroTrail>
          </div>
        </div>
      </Intro>
    </div>
  </IntroContainer>
)

export default BubbleSection
