
import { gateway } from './dataGateway';
import { AuditSchedule, User, Department, Location } from '../types';

export const bulkManagement = {
  /**
   * Processes a batch of new audits, creating departments, locations, and temporary users as needed.
   */
  async addAudits(
    newAudits: Omit<AuditSchedule, 'id'>[],
    currentUsers: User[],
    currentDepartments: Department[],
    currentLocations: Location[],
    departmentsWithAssets: any[]
  ) {
    // 1. Extract unique departments and locations from the new audits
    const uniqueDepts = Array.from(new Set(newAudits.map(a => a.departmentId)));
    const uniqueLocs = newAudits.map(a => ({ locationId: a.locationId, departmentId: a.departmentId }));

    // Calculate asset counts per location
    const locationAssetCounts: Record<string, number> = {};
    newAudits.forEach(a => {
      const key = `${a.locationId}|${a.departmentId}`;
      locationAssetCounts[key] = (locationAssetCounts[key] || 0) + 1;
    });

    // Remove duplicates from uniqueLocs
    const uniqueLocsFiltered = uniqueLocs.filter((loc, index, self) =>
      index === self.findIndex((t) => t.locationId === loc.locationId && t.departmentId === loc.departmentId)
    );

    // 2. Identify which ones are new
    const existingDeptIds = new Set(currentDepartments.map(d => d.id));
    const newDeptIds = uniqueDepts.filter(id => !existingDeptIds.has(id));

    const existingLocKeys = new Set(currentLocations.map(l => `${l.id}|${l.departmentId}`));
    const newLocs = uniqueLocsFiltered.filter(loc => !existingLocKeys.has(`${loc.locationId}|${loc.departmentId}`));

    // 2.5 Process Supervisors (Create temporary users if they don't exist)
    const uniqueSupervisors = Array.from(new Set(newAudits.map(a => a.supervisorId).filter(id => id && id !== 'To be filled')));
    const newUsersCreated: User[] = [];

    for (const supName of uniqueSupervisors) {
      const existingUser = currentUsers.find(u => u.name.toLowerCase() === supName.toLowerCase());
      if (!existingUser) {
        const tempId = `T-${Math.floor(1000 + Math.random() * 9000)}`;
        const newUser: User = {
          id: tempId,
          name: supName,
          email: `temp_${tempId}@example.com`,
          roles: ['Supervisor'],
          status: 'Inactive',
          isVerified: false
        };
        const addedUser = await gateway.addUser(newUser);
        newUsersCreated.push(addedUser);
      }
    }

    const getAllUsers = () => [...currentUsers, ...newUsersCreated];

    const getSupervisorId = (name: string) => {
      if (!name || name === 'To be filled') return '';
      const user = getAllUsers().find(u => u.name.toLowerCase() === name.toLowerCase());
      return user ? user.id : '';
    };

    const processedAudits = newAudits.map(a => ({
      ...a,
      supervisorId: getSupervisorId(a.supervisorId || '')
    }));

    // 3. Add new departments
    if (newDeptIds.length > 0) {
      for (const id of newDeptIds) {
        const newDept: Omit<Department, 'id'> = {
          name: `Imported Dept ${id}`,
          abbr: `IMP-${id.substring(0, 3)}`,
          headOfDeptId: 'dummy-user-id',
          description: `Imported department: ${id}`,
          auditGroupId: null
        };
        await gateway.addDepartment(newDept);
      }
    }

    // 4. Add new locations
    if (newLocs.length > 0) {
      const locsToAdd: Omit<Location, 'id'>[] = newLocs.map(loc => {
        const auditForLoc = processedAudits.find(a => a.locationId === loc.locationId && a.departmentId === loc.departmentId);
        const supId = auditForLoc ? auditForLoc.supervisorId : 'dummy-user-id';

        return {
          name: loc.locationId,
          abbr: loc.locationId.substring(0, 3).toUpperCase(),
          departmentId: loc.departmentId,
          building: 'Main',
          description: `Imported location: ${loc.locationId}`,
          supervisorId: supId,
          contact: '-',
          totalAssets: locationAssetCounts[`${loc.locationId}|${loc.departmentId}`] || 0
        };
      });
      await gateway.bulkAddLocations(locsToAdd);
    }

    // Update existing locations
    const existingLocsToUpdate = currentLocations.filter(l => locationAssetCounts[`${l.id}|${l.departmentId}`] !== undefined);
    for (const loc of existingLocsToUpdate) {
      const newCount = locationAssetCounts[`${loc.id}|${loc.departmentId}`];
      if (loc.totalAssets !== newCount) {
        await gateway.updateLocation(loc.id, { totalAssets: newCount });
      }
    }

    // 5. Finally add the audits (filtered by assets)
    const assetFilteredAudits = processedAudits.filter(a => {
      const dept = departmentsWithAssets.find(d => d.id === a.departmentId);
      return dept && (dept.totalAssets || 0) > 0;
    });

    if (assetFilteredAudits.length === 0) {
       return { success: false, message: 'No audits imported. All provided departments have zero assets.' };
    }

    const added = await gateway.bulkAddAudits(assetFilteredAudits);
    return {
      success: true,
      added,
      newDeptIds,
      newLocs,
      newUsersCreated
    };
  },

  /**
   * Processes a batch of locations, resolving departments and supervisors.
   */
  async addLocations(
    newLocs: Omit<Location, 'id'>[],
    currentDepartments: Department[],
    currentUsers: User[],
    currentLocations: Location[]
  ) {
    const deptNameToId = new Map<string, string>(currentDepartments.map(d => [d.name.toUpperCase().trim(), d.id]));
    const validDeptIds = new Set(currentDepartments.map(d => d.id.toLowerCase().trim()));

    const uniqueDeptNamesInImport = Array.from(new Set(newLocs.map(l => l.departmentId.toUpperCase().trim())));
    const missingDeptNames = uniqueDeptNamesInImport.filter(
      name => !deptNameToId.has(name) && !validDeptIds.has(name.toLowerCase())
    );

    if (missingDeptNames.length > 0) {
      const originalNames = missingDeptNames.map(n =>
        newLocs.find(l => l.departmentId.toUpperCase().trim() === n)?.departmentId || n
      );
      return { success: false, missingDepts: originalNames };
    }

    const userNameToId = new Map(currentUsers.map(u => [u.name.toUpperCase().trim(), u.id]));
    const uniqueSupervisorNames = Array.from(new Set(newLocs.map(l => (l.supervisorId || '').trim()).filter(n => n && n !== 'To be filled')));
    const missingSupervisors = uniqueSupervisorNames.filter(name => !userNameToId.has(name.toUpperCase().trim()));

    const newUsersCreated: User[] = [];
    for (const name of missingSupervisors) {
      const tempId = `T-${Math.floor(1000 + Math.random() * 9000)}`;
      const locMatch = newLocs.find(l => (l.supervisorId || '').trim() === name);
      const deptName = locMatch?.departmentId || '';
      const deptId = deptNameToId.get(deptName.toUpperCase().trim());
      const newUser: User = {
        id: tempId,
        name,
        email: `temp_${tempId}@pending.local`,
        roles: ['Supervisor'],
        status: 'Inactive',
        isVerified: false,
        departmentId: deptId,
      };
      const addedUser = await gateway.addUser(newUser);
      newUsersCreated.push(addedUser);
      userNameToId.set(name.toUpperCase().trim(), addedUser.id);
    }

    const resolvedLocs: Omit<Location, 'id'>[] = newLocs.map(loc => ({
      ...loc,
      departmentId: deptNameToId.get(loc.departmentId.toUpperCase().trim()) || loc.departmentId,
      supervisorId: userNameToId.get((loc.supervisorId || '').toUpperCase().trim()) || null,
    }));

    const existingLocsMap = new Map(currentLocations.map(l => [`${l.name.toUpperCase()}|${l.departmentId}`, l]));
    const locsToAdd: Omit<Location, 'id'>[] = [];
    const locsToUpdate: { id: string, updates: Partial<Location> }[] = [];

    const latestLocsFromImport = new Map<string, Omit<Location, 'id'>>();
    resolvedLocs.forEach(loc => latestLocsFromImport.set(`${loc.name.toUpperCase()}|${loc.departmentId}`, loc));

    latestLocsFromImport.forEach((loc, key) => {
      const existingLoc = existingLocsMap.get(key);
      if (!existingLoc) {
        locsToAdd.push(loc);
      }
    });

    if (locsToAdd.length > 0) await gateway.bulkAddLocations(locsToAdd);

    return {
      success: true,
      addedCount: locsToAdd.length,
      skippedCount: latestLocsFromImport.size - locsToAdd.length,
      newUsersCreated
    };
  },

  /**
   * Processes a batch of staff members for activation.
   * Only requires: Name, Email, Department (optional).
   * Defaults: Designation='Supervisor', Role='Staff'.
   */
  async activateStaff(
    entries: { name: string; email: string; department?: string }[],
    currentUsers: User[],
    currentDepartments: Department[]
  ) {
    const userEmailToObj = new Map(currentUsers.map(u => [u.email.toLowerCase().trim(), u]));
    const deptNameToId = new Map(currentDepartments.map(d => [d.name.toUpperCase().trim(), d.id]));
    let createdCount = 0;
    let skippedCount = 0;

    for (const entry of entries) {
      if (entry.email && userEmailToObj.has(entry.email.toLowerCase().trim())) {
        skippedCount++;
        continue;
      }
      const deptId = entry.department ? (deptNameToId.get(entry.department.toUpperCase().trim())) : undefined;
      const newUser: User = {
        id: crypto.randomUUID(),
        name: entry.name,
        email: entry.email || `${entry.name.replace(/\s+/g, '').toLowerCase()}@poliku.edu.my`,
        roles: ['Staff'],
        designation: 'Supervisor',
        status: 'Active',
        isVerified: true,
        departmentId: deptId,
      };
      await gateway.addUser(newUser);
      userEmailToObj.set(newUser.email.toLowerCase().trim(), newUser);
      createdCount++;
    }

    return { createdCount, skippedCount };
  },

  /**
   * Processes a batch of departments, creating or updating them.
   */
  async addDepartments(
    newDepts: Omit<Department, 'id'>[],
    currentDepartments: Department[],
    currentUsers: User[]
  ) {
    const existingDeptsMap = new Map(currentDepartments.map(d => [d.name.toUpperCase().trim(), d]));
    let usersChanged = false;
    let localUsers = [...currentUsers];

    for (const d of newDepts) {
      let finalHeadId = d.headOfDeptId;
      let newTempUserId: string | null = null;

      if (finalHeadId && finalHeadId.trim() !== '') {
        const existingUser = localUsers.find(u => u.id === finalHeadId || u.name.toLowerCase() === finalHeadId!.toLowerCase());
        if (existingUser) {
          finalHeadId = existingUser.id;
          if (existingUser.status === 'Pending' || !existingUser.isVerified) {
            await gateway.updateUser(existingUser.id, { status: 'Active', isVerified: true });
            usersChanged = true;
          }
        } else {
          const tempId = Math.floor(1000 + Math.random() * 9000).toString();
          const tempStaffId = `T-${tempId}`;
          const tempUser: User = {
            id: tempStaffId,
            name: finalHeadId,
            email: `temp${tempId}@asset-audit.pro`,
            roles: ['Staff'],
            designation: 'Head Of Department',
            status: 'Active',
            isVerified: true,
          };
          await gateway.addUser(tempUser);
          localUsers.push(tempUser);
          finalHeadId = tempStaffId;
          newTempUserId = tempStaffId;
          usersChanged = true;
        }
      } else {
        finalHeadId = null;
      }

      const existingDept = existingDeptsMap.get(d.name.toUpperCase().trim());
      if (!existingDept) {
        const createdDept = await gateway.addDepartment({ ...d, headOfDeptId: finalHeadId, auditGroupId: null });
        if (newTempUserId && createdDept?.id) await gateway.updateUser(newTempUserId, { departmentId: createdDept.id });
      }
    }

    return { usersChanged };
  }
};
