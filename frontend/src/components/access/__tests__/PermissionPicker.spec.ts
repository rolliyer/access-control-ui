import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PermissionPicker from '../PermissionPicker.vue'
import type { Domain } from '@/types/access-control'

const domains: Domain[] = [
  { key: 'sales', label: 'Sales', metricCount: 13, loadedByAgent: true },
  { key: 'support', label: 'Support', metricCount: 6, loadedByAgent: true },
  { key: 'marketing', label: 'Marketing', metricCount: 2, loadedByAgent: false },
]

describe('PermissionPicker', () => {
  it('reflects the selected permissions', () => {
    const wrapper = mount(PermissionPicker, {
      props: { domains, modelValue: [{ resourceType: 'domain', resourceKey: 'support' }] },
    })
    const checked = wrapper.findAll('input:checked')
    expect(checked).toHaveLength(1)
    expect(checked[0]!.element.closest('label')!.textContent).toContain('Support')
  })

  it('emits the new set when a box is toggled', async () => {
    const wrapper = mount(PermissionPicker, { props: { domains, modelValue: [] } })
    await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(true)
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([
      [{ resourceType: 'domain', resourceKey: 'sales' }],
    ])
  })

  it('warns when exploratory is granted without every domain', () => {
    const wrapper = mount(PermissionPicker, {
      props: {
        domains,
        modelValue: [
          { resourceType: 'domain', resourceKey: 'sales' },
          { resourceType: 'tier', resourceKey: 'exploratory' },
        ],
      },
    })
    expect(wrapper.find('[role="alert"]').text()).toContain('Exploratory SQL can read every table')
  })

  it('lists every catalogue domain, flagging ones the agent does not load', () => {
    const wrapper = mount(PermissionPicker, { props: { domains, modelValue: [] } })
    const marketing = wrapper.findAll('label').find((l) => l.text().includes('Marketing'))!
    expect(marketing.text()).toContain('not loaded by the agent yet')
  })

  it('offers to remove permissions for unknown domains', async () => {
    const wrapper = mount(PermissionPicker, {
      props: { domains, modelValue: [{ resourceType: 'domain', resourceKey: 'old_domain' }] },
    })
    expect(wrapper.text()).toContain('old_domain')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([[]])
  })
})
