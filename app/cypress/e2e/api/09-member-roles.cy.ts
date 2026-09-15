/// <reference types="cypress" />

// A WordPress administrator is an induction admin by default: they appear in
// the staff list and a module can be targeted at them. What must never follow
// from that is the app handing the role out — an induction_admin is not a full
// administrator and must not be able to mint one.

describe('Member roles', () => {
  let moduleId: number;

  before(() => {
    cy.api('POST', 'induction/v1/modules', {
      title: `Roles fixture ${Date.now()}`,
      status: 'publish',
    }).then(({ body }) => { moduleId = body.id; });
  });

  after(() => {
    if (moduleId) cy.api('DELETE', `induction/v1/modules/${moduleId}`);
  });

  it('lists administrator alongside the roles the app hands out', () => {
    cy.api('GET', 'induction/v1/roles').then(({ status, body }) => {
      expect(status).to.eq(200);

      const byValue = Object.fromEntries(
        body.map((r: { value: string }) => [r.value, r]),
      );
      expect(byValue, 'administrator is a recognised induction role').to.have.property('administrator');
      expect(byValue.administrator.assignable, 'but is never offered as a role to grant').to.eq(false);
      expect(byValue.staff.assignable).to.eq(true);
      expect(byValue.induction_admin.assignable).to.eq(true);
    });
  });

  it('returns only member-role accounts from the staff list', () => {
    cy.api('GET', 'induction/v1/roles').then(({ body: roles }) => {
      const members = roles.map((r: { value: string }) => r.value);
      cy.api('GET', 'induction/v1/staff').then(({ body: staff }) => {
        expect(staff).to.be.an('array');
        staff.forEach((s: { id: number; roles: string[] }) => {
          expect(s.roles.some((r) => members.includes(r)), `user ${s.id} holds a member role`).to.eq(true);
        });
      });
    });
  });

  it('lets a module be targeted at administrators', () => {
    cy.api('POST', 'induction/v1/assignments/role', {
      module_id: moduleId,
      role: 'administrator',
    }).its('status').should('eq', 200);

    cy.api('GET', `induction/v1/modules/${moduleId}`).then(({ body }) => {
      expect(body.meta.module_role_targets).to.include('administrator');
    });

    cy.api('POST', 'induction/v1/assignments/role/remove', {
      module_id: moduleId,
      role: 'administrator',
    }).its('status').should('eq', 200);
  });

  it('refuses to create an administrator through Add Staff', () => {
    cy.api('POST', 'induction/v1/staff', {
      name: 'Escalation Attempt',
      username: `escalate${Date.now()}`,
      email: `escalate${Date.now()}@example.com`,
      role: 'administrator',
      password: 'a-long-enough-password',
    }).then(({ status, body }) => {
      expect(status).to.eq(400);
      expect(body.code).to.eq('invalid_role');
    });
  });

  it('refuses to promote an existing staff member to administrator', () => {
    cy.api('GET', 'induction/v1/staff').then(({ body }) => {
      const target = body.find(
        (s: { roles: string[] }) => s.roles.includes('staff') && !s.roles.includes('administrator'),
      );
      expect(target, 'the test site needs a staff-role account').to.exist;

      cy.api('POST', `induction/v1/staff/${target.id}/role`, { role: 'administrator' })
        .then(({ status, body: err }) => {
          expect(status).to.eq(400);
          expect(err.code).to.eq('invalid_role');
        });
    });
  });
});
