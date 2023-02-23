import { Button } from '../Button'
import { Icon, IconName } from '../Icon'
import { Intro, IntroContainer, IntroTrail } from '../intro'

type SocialItemProps = {
  url: string
  iconName: IconName
  count: string
}

const socialItems: SocialItemProps[] = [
  {
    url: 'https://url.prepo.io/discord-website-desktop',
    iconName: 'socialDiscord',
    count: '15,000+',
  },
  {
    url: 'https://twitter.com/prepo_io',
    iconName: 'socialTwitter',
    count: '25,000+',
  },
]

const SocialItem: React.FC<SocialItemProps> = ({ url, iconName, count }) => (
  <a
    className="flex items-center duration-300 hover:scale-110 cursor-pointer"
    href={url}
    target="_blank"
    rel="noreferrer"
  >
    <Icon className="w-16 h-16 md:w-24 md:h-24" name={iconName} />
    <p className="ml-2 font-bold text-[#40444F] md:ml-[17px] md:text-3xl">{count}</p>
  </a>
)

const CommunitySection: React.FC = () => (
  <IntroContainer>
    <div className="container px-10 mx-auto mt-10 mb-40 text-center md:mt-20">
      <Intro type="fadeInUp">
        <div className="flex flex-col justify-center items-center mt-[51px] w-full md:mt-13">
          <div className="grid grid-cols-2 gap-x-6 md:gap-x-[78px]">
            <IntroTrail keys={socialItems.map(({ url }) => url)}>
              {socialItems.map((props) => (
                // eslint-disable-next-line react/jsx-props-no-spreading
                <SocialItem key={props.url} {...props} />
              ))}
            </IntroTrail>
          </div>
        </div>
        <div className="mt-14">
          <Button href="https://url.prepo.io/jobs-website" target="_blank">
            We&apos;re hiring
          </Button>
        </div>
      </Intro>
    </div>
  </IntroContainer>
)

export default CommunitySection
