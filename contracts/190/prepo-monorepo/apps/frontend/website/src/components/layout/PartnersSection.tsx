import { useState } from 'react'
import { angels, integrations, investors, collaborations } from '../../lib/partners'
import { Icon, IconName } from '../Icon'
import { Intro, IntroContainer, IntroTrail } from '../intro'
import Tabs from '../Tabs'

export type Partner = {
  name: string
  description?: string
  url?: string
  iconName?: IconName
}

type GroupedPartnerProps = {
  id: string
  active: boolean
  showName?: boolean
  partners: Partner[]
  hasMore?: boolean
}

const OtherText: React.FC = ({ children }) => (
  <div className="block h-full">
    <div className="flex justify-center items-center w-full h-full">
      <p className="text-[11px] font-semibold text-black xs:text-sm md:text-lg">{children}</p>
    </div>
  </div>
)
const PartnerCircle: React.FC<{ showName?: boolean; id: string } & Partner> = ({
  id,
  showName,
  name,
  description,
  iconName,
  url,
}) => (
  <a href={url} target="_blank" rel="noreferrer" className="w-full">
    {/* pt-[100%] will reserve height same as width for the image so we get absolute circle */}
    <div className="relative pt-[100%]">
      <div className="overflow-hidden absolute top-0 left-0 p-[3px] w-full h-full bg-prepo/5 rounded-full duration-300 hover:scale-110 md:p-[6px]">
        {iconName !== undefined && (
          <Icon id={id} name={iconName} className="w-full h-full rounded-full" />
        )}
      </div>
    </div>
    {showName && (
      <div className="mt-[6px] text-center">
        <p className="text-[11px] font-bold text-[#262626] xs:text-sm md:text-lg">{name}</p>
        <p className="text-[9px] font-medium text-[#7C89A0] md:text-sm">{description}</p>
      </div>
    )}
  </a>
)

const GroupedPartners: React.FC<GroupedPartnerProps> = ({
  id,
  active,
  hasMore,
  showName,
  partners,
}) => (
  <div className="flex flex-col justify-center items-center pt-7 w-full lg:pt-14">
    <div className="flex flex-wrap justify-center px-[20px] w-full max-w-[1058px] md:px-6">
      <IntroTrail
        trailProps={{
          config: { tension: 250 },
          transform: active ? 'scale(1)' : 'scale(0.01)',
          from: { transform: 'scale(0.01)' },
        }}
        componentClassName="px-[14px] md:px-8 pb-7 md:pb-5 w-full flex-[0_0_33.333%] md:flex-[0_0_25%]"
        keys={partners
          .map(({ name }) => name)
          .concat(hasMore ? 'and-more' : '')
          .filter(Boolean)}
      >
        {partners.map(({ iconName, name, description, url }) => (
          <PartnerCircle
            id={`${id}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
            key={name}
            showName={showName}
            name={name}
            description={description}
            iconName={iconName}
            url={url}
          />
        ))}
        {hasMore && <OtherText key="and-more">and many more...</OtherText>}
      </IntroTrail>
    </div>
  </div>
)

const PartnersSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0)
  const onTabChange = (index: number): void => {
    setActiveTab(index)
  }
  return (
    <IntroContainer>
      <div className="container mx-auto mt-9 mb-20 max-w-full text-center md:mt-15">
        <Intro type="fadeInUp">
          <Tabs
            onChange={onTabChange}
            options={[
              {
                label: 'Investors',
                component: (
                  <GroupedPartners
                    id="investors"
                    active={activeTab === 0}
                    key="investors"
                    partners={investors}
                  />
                ),
              },
              {
                label: 'Angels',
                component: (
                  <GroupedPartners
                    id="angels"
                    active={activeTab === 1}
                    hasMore
                    key="angels"
                    partners={angels}
                    showName
                  />
                ),
              },
              {
                label: 'Integrations',
                component: (
                  <GroupedPartners
                    id="integrations"
                    active={activeTab === 2}
                    key="integrations"
                    partners={integrations}
                  />
                ),
              },
              {
                label: 'Collaborations',
                component: (
                  <GroupedPartners
                    id="collaborations"
                    active={activeTab === 3}
                    key="collaborations"
                    partners={collaborations}
                  />
                ),
              },
            ]}
          />
        </Intro>
      </div>
    </IntroContainer>
  )
}

export default PartnersSection
